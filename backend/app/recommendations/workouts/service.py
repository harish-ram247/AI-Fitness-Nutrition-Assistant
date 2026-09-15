"""Phase 7C – Workout Recommendation Service.

Thin orchestrator coordinating:
  WorkoutRecommendationContextBuilder
      → WorkoutCandidateGenerator (with injected AsyncSession)
      → RecommendationEngine (filters then scoring)
      → Response mapping
"""

from __future__ import annotations

from typing import Any

from app.models.user import User
from app.recommendations.engine import RecommendationEngine
from app.recommendations.filter import CandidateFilter
from app.recommendations.scoring import RecommendationScorer, ScoringFactor
from app.recommendations.workouts.context_builder import WorkoutRecommendationContextBuilder
from app.recommendations.workouts.filters import (
    WorkoutDurationFilter,
    WorkoutEquipmentFilter,
    WorkoutStructureFilter,
    WorkoutVisibilityFilter,
)
from app.recommendations.workouts.generator import WorkoutCandidateGenerator
from app.recommendations.workouts.models import WorkoutPayload
from app.recommendations.workouts.scoring import (
    ExerciseNoveltyFactor,
    MuscleGroupFreshnessFactor,
    WorkoutDurationFitFactor,
    WorkoutGoalAlignmentFactor,
)

_DISCLAIMER: str = (
    "Workout recommendations are training suggestions based on catalog metadata and recent logs. "
    "They do not replace medical advice or professional athletic instruction."
)


class WorkoutRecommendationService:
    """Orchestrates the deterministic workout recommendation pipeline."""

    def __init__(
        self,
        context_builder: WorkoutRecommendationContextBuilder,
        generator: WorkoutCandidateGenerator,
    ) -> None:
        self.context_builder = context_builder
        self.generator = generator

    async def recommend(
        self,
        user: User,
        target_duration_minutes: int | None = None,
        workout_type: str | None = None,
        equipment: list[str] | None = None,
        limit: int = 5,
    ) -> dict[str, Any]:
        """Execute the workout recommendation pipeline and return response dict."""
        # 1. Compile pure RecommendationContext
        context = await self.context_builder.build(
            user=user,
            target_duration_minutes=target_duration_minutes,
            workout_type=workout_type,
            equipment=equipment,
        )

        # 2. Configure filters and scoring factors
        filters: list[CandidateFilter] = [
            WorkoutVisibilityFilter(),
            WorkoutEquipmentFilter(),
            WorkoutDurationFilter(),
            WorkoutStructureFilter(),
        ]
        factors: list[ScoringFactor] = [
            WorkoutGoalAlignmentFactor(),
            MuscleGroupFreshnessFactor(),
            WorkoutDurationFitFactor(),
            ExerciseNoveltyFactor(),
        ]
        scorer = RecommendationScorer(factors)

        # 3. Instantiate generic engine and execute
        engine: RecommendationEngine[WorkoutPayload] = RecommendationEngine(
            generator=self.generator,
            scorer=scorer,
            filters=filters,
        )

        result = await engine.recommend(context, top_n=limit)

        # 4. Map ranked candidates to response schema items
        items: list[dict[str, Any]] = []
        for scored in result.ranked_candidates:
            cand = scored.candidate
            payload = cand.payload

            factor_score_dicts = [
                {
                    "factor_name": fs.factor_name,
                    "normalized_score": fs.normalized_score,
                    "weight": fs.weight,
                    "weighted_contribution": fs.weighted_contribution,
                    "reason": fs.reason,
                }
                for fs in scored.factor_scores
            ]

            exercise_dicts = [
                {
                    "exercise_id": e.exercise_id,
                    "exercise_name": e.exercise_name,
                    "category": e.category,
                    "muscle_groups": e.muscle_groups,
                    "equipment": e.equipment,
                    "order_index": e.order_index,
                    "recommended_sets": e.recommended_sets,
                    "recommended_reps": e.recommended_reps,
                    "recommended_duration_seconds": e.recommended_duration_seconds,
                    "recommended_rest_seconds": e.recommended_rest_seconds,
                }
                for e in payload.exercises
            ]

            items.append(
                {
                    "id": cand.id,
                    "name": payload.name,
                    "workout_type": payload.workout_type,
                    "category": payload.category,
                    "target_muscle_groups": payload.target_muscle_groups,
                    "estimated_duration_minutes": payload.estimated_duration_minutes,
                    "total_sets": payload.total_sets,
                    "primary_equipment_needed": payload.primary_equipment_needed,
                    "variant": payload.variant,
                    "score": round(scored.score, 4),
                    "reasons": scored.reasons,
                    "factor_scores": factor_score_dicts,
                    "exercises": exercise_dicts,
                }
            )

        effective_duration = context.constraints.target_duration_minutes or 45

        return {
            "recommendation_type": "workout",
            "target_duration_minutes": effective_duration,
            "workout_type": workout_type,
            "items": items,
            "total_generated": result.total_generated,
            "total_survived_filtering": result.total_survived_filtering,
            "disclaimer": _DISCLAIMER,
            "metadata": {
                "recent_sessions_found_7d": context.metadata.get("recent_sessions_found_7d", 0),
                "last_workout_date": context.metadata.get("last_workout_date"),
            },
        }
