"""Phase 7B – Meal Recommendation Context Builder.

Implements the tracked vs. untracked daily budget pipeline exactly as specified.

Scenario A: calorie_target != None (Tracked Daily Budget)
  → C_remaining = max(0, T_daily - C_consumed)
  → C_remaining <= 0: return None (empty result sentinel)
  → 0 < C_remaining < 100: return None (empty result sentinel)
  → C_remaining >= 100: continue; hard ceiling = C_remaining

Scenario B: calorie_target == None AND target_calories supplied (Untracked)
  → No C_remaining; low-budget rules NOT evaluated
  → T_meal = target_calories; hard ceiling = target_calories
  → remaining_daily_calories = None

Scenario C: calorie_target == None AND target_calories == None
  → Raise HTTP 422

Builds and returns a RecommendationContext carrying all derived values in
context.metadata for use by filters, scoring factors, and the response builder.
"""

from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import FitnessGoal
from app.models.user import User
from app.recommendations.context import (
    GoalContext,
    PreferencesContext,
    RecommendationContext,
)
from app.recommendations.types import RecommendationType
from app.repositories.goal_repository import GoalRepository
from app.services.nutrition_service import NutritionService

# ── meal-type shares (sum = 1.00 exactly) ────────────────────────────────
_MEAL_SHARES: dict[str, Decimal] = {
    "breakfast": Decimal("0.25"),
    "lunch": Decimal("0.35"),
    "dinner": Decimal("0.30"),
    "snack": Decimal("0.10"),
}

# Validate at import time – fail fast if accidentally altered
assert sum(_MEAL_SHARES.values()) == Decimal("1.00"), "Meal shares must sum to exactly 1.00"  # noqa: S101

VALID_MEAL_TYPES: frozenset[str] = frozenset(_MEAL_SHARES)


# ── macro target derivation ───────────────────────────────────────────────

def _derive_macro_targets(
    protein_target_g: Decimal | None,
    carbs_target_g: Decimal | None,
    fat_target_g: Decimal | None,
    e_ref: float,
    goal_type: str | None,
) -> tuple[float, float, float]:
    """Return (t_p, t_c, t_f) as energy fractions summing to 1.0.

    Uses the 8-case deterministic heuristic defined in the approved plan.
    Fallbacks (20 %, 15 %, 2:1, 1:1, 1:2 splits) are documented heuristics
    used ONLY when the user provides incomplete macro targets.
    """
    def pos(v: Decimal | None) -> bool:
        return v is not None and v > Decimal("0")

    has_p = pos(protein_target_g)
    has_c = pos(carbs_target_g)
    has_f = pos(fat_target_g)

    e_p = float(protein_target_g) * 4.0 if protein_target_g is not None and has_p else 0.0
    e_c = float(carbs_target_g) * 4.0 if carbs_target_g is not None and has_c else 0.0
    e_f = float(fat_target_g) * 9.0 if fat_target_g is not None and has_f else 0.0

    if e_ref <= 0.0:
        # E_ref unavailable – fall back to goal defaults
        has_p = has_c = has_f = False

    def _clamp_split_p_only() -> tuple[float, float, float]:
        t_p = min(0.40, max(0.15, e_p / e_ref))
        t_c = round((1.0 - t_p) * (2.0 / 3.0), 4)
        t_f = 1.0 - t_p - t_c
        return t_p, t_c, t_f

    def _clamp_split_c_only() -> tuple[float, float, float]:
        t_c = min(0.65, max(0.30, e_c / e_ref))
        t_p = round((1.0 - t_c) / 2.0, 4)
        t_f = 1.0 - t_c - t_p
        return t_p, t_c, t_f

    def _clamp_split_f_only() -> tuple[float, float, float]:
        t_f = min(0.40, max(0.15, e_f / e_ref))
        t_p = round((1.0 - t_f) * (1.0 / 3.0), 4)
        t_c = 1.0 - t_f - t_p
        return t_p, t_c, t_f

    if has_p and has_c and has_f:
        # Case 1: all three present
        e_sum = e_p + e_c + e_f
        return e_p / e_sum, e_c / e_sum, e_f / e_sum

    elif has_p and has_c and not has_f:
        # Case 2: P + C
        if e_p + e_c < e_ref:
            e_f_fill = e_ref - (e_p + e_c)
            e_sum = e_ref
            return e_p / e_sum, e_c / e_sum, e_f_fill / e_sum
        else:
            t_f = 0.20
            denom = e_p + e_c
            t_p = 0.80 * (e_p / denom)
            t_c = 0.80 * (e_c / denom)
            return t_p, t_c, t_f

    elif has_p and has_f and not has_c:
        # Case 3: P + F
        if e_p + e_f < e_ref:
            e_c_fill = e_ref - (e_p + e_f)
            e_sum = e_ref
            return e_p / e_sum, e_c_fill / e_sum, e_f / e_sum
        else:
            t_c = 0.15
            denom = e_p + e_f
            t_p = 0.85 * (e_p / denom)
            t_f = 0.85 * (e_f / denom)
            return t_p, t_c, t_f

    elif has_c and has_f and not has_p:
        # Case 4: C + F
        if e_c + e_f < e_ref:
            e_p_fill = e_ref - (e_c + e_f)
            e_sum = e_ref
            return e_p_fill / e_sum, e_c / e_sum, e_f / e_sum
        else:
            t_p = 0.20
            denom = e_c + e_f
            t_c = 0.80 * (e_c / denom)
            t_f = 0.80 * (e_f / denom)
            return t_p, t_c, t_f

    elif has_p and not has_c and not has_f:
        return _clamp_split_p_only()

    elif has_c and not has_p and not has_f:
        return _clamp_split_c_only()

    elif has_f and not has_p and not has_c:
        return _clamp_split_f_only()

    else:
        # Case 8: none present – use goal-based defaults
        if goal_type == "muscle_gain":
            return 0.30, 0.45, 0.25
        elif goal_type == "weight_loss":
            return 0.30, 0.40, 0.30
        else:
            return 0.25, 0.50, 0.25


class MealRecommendationContextBuilder:
    """Builds a fully-populated RecommendationContext for meal recommendations.

    The builder performs all calorie/protein target derivations, macro target
    derivations, and budget invariant checks.  It raises HTTP 422 for
    unconfigured calorie targets (Scenario C) and returns a sentinel dict
    `{"empty": True, "reason": ...}` for low-budget situations (Scenario A
    sub-cases) to allow the service to return an empty response without
    invoking the generator.
    """

    def __init__(
        self,
        nutrition_service: NutritionService,
        goal_repository: GoalRepository,
        db_session: AsyncSession,
    ) -> None:
        self.nutrition_service = nutrition_service
        self.goal_repository = goal_repository
        self.db_session = db_session

    async def build(
        self,
        user: User,
        meal_type: str,
        target_calories_override: int | None,
    ) -> tuple[RecommendationContext, dict[str, Any]]:
        """Build RecommendationContext and return auxiliary metadata dict.

        Returns:
            (context, aux) where aux may contain {"empty": True, "reason": ...}
            to signal that the service should return an empty recommendation
            without invoking the generator.

        Raises:
            HTTPException(422): when calorie_target is None and no override supplied.
            HTTPException(422): when meal_type is invalid.
        """
        # ── validate meal_type ────────────────────────────────────────────
        if meal_type not in VALID_MEAL_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Invalid meal_type '{meal_type}'. "
                    f"Must be one of: {sorted(VALID_MEAL_TYPES)}."
                ),
            )

        prefs = user.preferences
        today = datetime.date.today()
        s_meal = _MEAL_SHARES[meal_type]

        # Determine active goal type
        active_goals = await self.goal_repository.list_by_user(user.id, status="active")
        goal_type: str | None = None
        active_goal: FitnessGoal | None = None
        if active_goals:
            active_goal = active_goals[0]
            goal_type = active_goal.goal_type

        calorie_target: int | None = prefs.calorie_target if prefs else None

        metadata: dict[str, Any] = {
            "meal_type": meal_type,
            "meal_type_defaulted": False,
            "goal_type": goal_type,
            "db_session": self.db_session,
        }
        aux: dict[str, Any] = {}

        # ── Scenario C: no calorie target and no override → 422 ──────────
        if calorie_target is None and target_calories_override is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No calorie target is configured for this user. "
                    "Please configure calorie_target in user preferences "
                    "or provide an explicit target_calories parameter."
                ),
            )

        # Collect today's nutrition totals (needed for Scenario A)
        daily_summary = await self.nutrition_service.get_daily_summary(user.id, today)
        c_consumed = float(daily_summary.totals.calories)
        p_consumed = float(daily_summary.totals.protein_g)

        # ── Scenario A: tracked daily budget ─────────────────────────────
        if calorie_target is not None:
            t_daily = float(calorie_target)
            c_remaining = max(0.0, t_daily - c_consumed)
            metadata["daily_budget_tracked"] = True
            metadata["remaining_daily_calories"] = c_remaining

            if c_remaining <= 0.0:
                aux = {
                    "empty": True,
                    "reason": "Daily calorie target already reached or exceeded.",
                    "remaining_daily_calories": 0.0,
                    "daily_budget_tracked": True,
                }
                context = self._build_minimal_context(user, meal_type, metadata)
                return context, aux

            if c_remaining < 100.0:
                aux = {
                    "empty": True,
                    "reason": (
                        f"Remaining calorie budget ({c_remaining:.0f} kcal) is below "
                        f"the minimum meal threshold of 100 kcal."
                    ),
                    "remaining_daily_calories": c_remaining,
                    "daily_budget_tracked": True,
                }
                context = self._build_minimal_context(user, meal_type, metadata)
                return context, aux

            # C_remaining >= 100: continue
            # Determine T_meal (scoring target)
            warnings: list[str] = []
            if target_calories_override is not None:
                t_meal = float(target_calories_override)
                if t_meal > c_remaining:
                    warnings.append(
                        f"Requested target_calories ({t_meal:.0f}) exceeds remaining "
                        f"daily calorie budget ({c_remaining:.0f}). "
                        f"Returned candidates are strictly constrained by remaining daily budget."
                    )
            else:
                t_meal_base = round(t_daily * float(s_meal))
                t_meal = min(t_meal_base, c_remaining)

            # Hard ceiling is ALWAYS C_remaining in tracked mode
            calorie_ceiling = c_remaining
            e_ref = t_daily  # reference energy for macro derivation

        # ── Scenario B: untracked (calorie_target is None, override supplied) ──
        else:
            assert target_calories_override is not None  # noqa: S101 (guarded above)
            t_meal = float(target_calories_override)
            calorie_ceiling = t_meal
            c_remaining = None  # noqa: F841  (only used in tracked branch)
            warnings = []
            metadata["daily_budget_tracked"] = False
            metadata["remaining_daily_calories"] = None
            # E_ref for macro derivation: extrapolated from meal target
            e_ref = t_meal / float(s_meal) if float(s_meal) > 0 else 0.0

        # ── Protein target derivation ──────────────────────────────────────
        p_daily: float | None = (
            float(prefs.protein_target_g) if (prefs and prefs.protein_target_g) else None
        )

        if p_daily is not None and p_daily > 0.0:
            p_meal_base = round(p_daily * float(s_meal), 1)
            p_remaining = max(0.0, p_daily - p_consumed)
            p_meal = min(p_meal_base, p_remaining)
        else:
            p_meal = round(t_meal * 0.25 / 4.0, 1)

        # ── Macro target derivation ────────────────────────────────────────
        t_p, t_c, t_f = _derive_macro_targets(
            protein_target_g=prefs.protein_target_g if prefs else None,
            carbs_target_g=prefs.carbs_target_g if prefs else None,
            fat_target_g=prefs.fat_target_g if prefs else None,
            e_ref=e_ref,
            goal_type=goal_type,
        )

        # ── Populate metadata ──────────────────────────────────────────────
        metadata.update(
            {
                "target_calories": t_meal,
                "calorie_ceiling": calorie_ceiling,
                "target_protein_g": p_meal,
                "macro_target_p": t_p,
                "macro_target_c": t_c,
                "macro_target_f": t_f,
            }
        )
        if warnings:
            metadata["warnings"] = warnings

        # ── Build preferences context (carries dietary / allergy / dislike) ──
        prefs_context = PreferencesContext(
            dietary_restrictions=list(prefs.dietary_restrictions) if prefs else [],
            allergies=[],   # UserPreference has no allergies field; passed via query param
            disliked_foods=[],  # passed via query param
            target_calories=calorie_target,
            target_protein_g=(
                float(prefs.protein_target_g)
                if (prefs and prefs.protein_target_g) else None
            ),
            target_carbs_g=(
                float(prefs.carbs_target_g)
                if (prefs and prefs.carbs_target_g) else None
            ),
            target_fat_g=(
                float(prefs.fat_target_g)
                if (prefs and prefs.fat_target_g) else None
            ),
        )

        goal_context: GoalContext | None = None
        if active_goal is not None:
            goal_context = GoalContext(
                goal_type=active_goal.goal_type,
                target_value=float(active_goal.target_value) if active_goal.target_value else None,
                target_unit=active_goal.target_unit,
            )

        context = RecommendationContext(
            user_id=user.id,
            recommendation_type=RecommendationType.MEAL,
            preferences=prefs_context,
            goal=goal_context,
            metadata=metadata,
        )
        return context, aux

    def _build_minimal_context(
        self, user: User, meal_type: str, metadata: dict[str, Any]
    ) -> RecommendationContext:
        """Minimal context for early-return (empty result) scenarios."""
        return RecommendationContext(
            user_id=user.id,
            recommendation_type=RecommendationType.MEAL,
            metadata=metadata,
        )
