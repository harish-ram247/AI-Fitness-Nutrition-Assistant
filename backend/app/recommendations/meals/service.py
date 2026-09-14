"""Phase 7B – Meal Recommendation Service.

Thin orchestrator following the approved pipeline:

  MealRecommendationContextBuilder
      → check aux['empty'] → early return if needed
      → inject allergies / disliked_foods into context.preferences (from query params)
      → MealCandidateGenerator (async)
      → RecommendationEngine (async; runs filters then scoring)
      → response mapping

No persistence, no LLM, no RAG.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.recommendations.engine import RecommendationEngine
from app.recommendations.meals.context_builder import MealRecommendationContextBuilder
from app.recommendations.meals.filters import (
    MealAllergyFilter,
    MealCalorieCeilingFilter,
    MealDietaryRestrictionFilter,
    MealDislikedFoodFilter,
    MealNutrientCompletenessFilter,
)
from app.recommendations.meals.generator import MealCandidateGenerator
from app.recommendations.meals.models import MealPayload
from app.recommendations.meals.scoring import (
    MealCalorieProximityFactor,
    MealGoalAlignmentFactor,
    MealMacroBalanceFactor,
    MealProteinProximityFactor,
)
from app.recommendations.result import RecommendationResult
from app.recommendations.scoring import RecommendationScorer

_DISCLAIMER = (
    "Allergen and dietary filtering is based on food names and USDA category metadata. "
    "It does not replace medical advice or guarantee the absence of cross-contamination."
)


class MealRecommendationService:
    """Orchestrates the full meal recommendation pipeline."""

    def __init__(
        self,
        context_builder: MealRecommendationContextBuilder,
    ) -> None:
        self.context_builder = context_builder

    async def recommend(
        self,
        user: User,
        meal_type: str,
        target_calories_override: int | None,
        allergies: list[str],
        disliked_foods: list[str],
        limit: int,
        db_session: AsyncSession,
    ) -> dict[str, Any]:
        """Execute the meal recommendation pipeline and return response dict."""

        # ── 1. Build context (performs all target derivation and budget checks) ──
        context, aux = await self.context_builder.build(
            user=user,
            meal_type=meal_type,
            target_calories_override=target_calories_override,
        )

        # ── 2. Early return for empty-result scenarios ──────────────────────
        if aux.get("empty"):
            return {
                "recommendation_type": "meal",
                "meal_type": meal_type,
                "target_calories": None,
                "target_protein_g": None,
                "remaining_daily_calories": aux.get("remaining_daily_calories"),
                "items": [],
                "total_generated": 0,
                "total_survived_filtering": 0,
                "disclaimer": _DISCLAIMER,
                "metadata": {
                    "daily_budget_tracked": aux.get("daily_budget_tracked", True),
                    "reason": aux.get("reason", ""),
                },
            }

        # ── 3. Inject allergies and disliked_foods into preferences context ──
        # PreferencesContext is immutable; reconstruct with query-supplied values.
        if context.preferences is not None:
            from app.recommendations.context import PreferencesContext
            updated_prefs = PreferencesContext(
                dietary_restrictions=list(context.preferences.dietary_restrictions),
                allergies=list(allergies),
                disliked_foods=list(disliked_foods),
                target_calories=context.preferences.target_calories,
                target_protein_g=context.preferences.target_protein_g,
                target_carbs_g=context.preferences.target_carbs_g,
                target_fat_g=context.preferences.target_fat_g,
            )
        else:
            from app.recommendations.context import PreferencesContext
            updated_prefs = PreferencesContext(
                allergies=list(allergies),
                disliked_foods=list(disliked_foods),
            )

        updated_metadata = dict(context.metadata)
        updated_metadata["db_session"] = db_session

        from app.recommendations.context import RecommendationContext
        context = RecommendationContext(
            user_id=context.user_id,
            recommendation_type=context.recommendation_type,
            preferences=updated_prefs,
            goal=context.goal,
            metadata=updated_metadata,
        )

        # ── 4. Build engine components ──────────────────────────────────────
        generator = MealCandidateGenerator()

        scorer = RecommendationScorer(
            factors=[
                MealCalorieProximityFactor(),
                MealProteinProximityFactor(),
                MealMacroBalanceFactor(),
                MealGoalAlignmentFactor(),
            ]
        )

        from app.recommendations.filter import CandidateFilter
        filters: list[CandidateFilter] = [
            MealAllergyFilter(),
            MealDietaryRestrictionFilter(),
            MealDislikedFoodFilter(),
            MealNutrientCompletenessFilter(),
            MealCalorieCeilingFilter(),
        ]

        engine: RecommendationEngine[MealPayload] = RecommendationEngine(
            generator=generator,
            scorer=scorer,
            filters=filters,
        )

        # ── 5. Execute pipeline ─────────────────────────────────────────────
        result: RecommendationResult[MealPayload] = await engine.recommend(
            context=context, top_n=limit
        )

        # ── 6. Map result to response dict ──────────────────────────────────
        items = []
        for sc in result.ranked_candidates:  # sc: ScoredCandidate[MealPayload]
            payload: MealPayload = sc.candidate.payload
            items.append(
                {
                    "id": sc.candidate.id,
                    "name": _candidate_name(payload),
                    "meal_type": payload.meal_type,
                    "components": [
                        {
                            "food_id": str(c.food_id),
                            "food_name": c.food_name,
                            "quantity_g": str(c.quantity_g),
                            "serving_id": str(c.serving_id) if c.serving_id else None,
                            "serving_description": c.serving_description,
                            "serving_count": str(c.serving_count),
                            "calories": str(c.calories),
                            "protein_g": str(c.protein_g),
                            "carbs_g": str(c.carbs_g),
                            "fat_g": str(c.fat_g),
                        }
                        for c in payload.components
                    ],
                    "total_calories": str(payload.total_calories),
                    "total_protein_g": str(payload.total_protein_g),
                    "total_carbs_g": str(payload.total_carbs_g),
                    "total_fat_g": str(payload.total_fat_g),
                    "score": round(sc.score, 6),
                    "reasons": sc.reasons,
                    "factor_scores": [
                        {
                            "factor_name": fs.factor_name,
                            "normalized_score": fs.normalized_score,
                            "weight": fs.weight,
                            "weighted_contribution": fs.weighted_contribution,
                            "reason": fs.reason,
                        }
                        for fs in sc.factor_scores
                    ],
                }
            )

        response_metadata: dict[str, Any] = {
            "daily_budget_tracked": context.metadata.get("daily_budget_tracked"),
        }
        if context.metadata.get("meal_type_defaulted"):
            response_metadata["meal_type_defaulted"] = True
        if context.metadata.get("warnings"):
            response_metadata["warnings"] = context.metadata["warnings"]

        remaining = context.metadata.get("remaining_daily_calories")

        return {
            "recommendation_type": "meal",
            "meal_type": meal_type,
            "target_calories": context.metadata.get("target_calories"),
            "target_protein_g": context.metadata.get("target_protein_g"),
            "remaining_daily_calories": remaining,
            "items": items,
            "total_generated": result.total_generated,
            "total_survived_filtering": result.total_survived_filtering,
            "disclaimer": _DISCLAIMER,
            "metadata": response_metadata,
        }


def _candidate_name(payload: MealPayload) -> str:
    """Human-readable name from component food names."""
    return " + ".join(c.food_name for c in payload.components)
