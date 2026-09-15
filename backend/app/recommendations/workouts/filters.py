"""Phase 7C – Hard Constraint Filters for Workout Recommendations.

Evaluated synchronously by RecommendationEngine before scoring.
"""

from __future__ import annotations

import math
from typing import Any

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.filter import FilterResult
from app.recommendations.workouts.models import WorkoutPayload


class WorkoutVisibilityFilter:
    """Defense-in-depth filter verifying all exercises in the candidate are visible to the user."""

    @property
    def name(self) -> str:
        return "workout_visibility"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        payload: WorkoutPayload = candidate.payload
        if not isinstance(payload, WorkoutPayload):
            return FilterResult(is_eligible=False, reason="Invalid candidate payload type.")

        visible_ids = context.metadata.get("visible_exercise_ids")
        if visible_ids is not None:
            visible_set = set(visible_ids)
            for e in payload.exercises:
                if str(e.exercise_id) not in visible_set and e.exercise_id not in visible_set:
                    return FilterResult(
                        is_eligible=False,
                        reason=f"Exercise '{e.exercise_name}' is not visible to the user.",
                    )

        return FilterResult(is_eligible=True)


class WorkoutEquipmentFilter:
    """Filters out workout candidates requiring equipment not available to the user.

    Semantics (Option A):
      If available_equipment is empty, access is unconstrained (all candidates pass).
      If available_equipment is provided, every exercise must require either 'none', 'bodyweight',
      or one of the specified equipment items.
    """

    @property
    def name(self) -> str:
        return "workout_equipment"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        payload: WorkoutPayload = candidate.payload
        if not isinstance(payload, WorkoutPayload):
            return FilterResult(is_eligible=False, reason="Invalid candidate payload type.")

        available = context.constraints.available_equipment
        # Unconstrained if empty / not specified
        if not available:
            return FilterResult(is_eligible=True)

        allowed_set = {"none", "bodyweight"} | {eq.strip().lower() for eq in available if eq}

        for e in payload.exercises:
            if e.equipment:
                cleaned_eq = e.equipment.strip().lower()
                if cleaned_eq not in allowed_set:
                    return FilterResult(
                        is_eligible=False,
                        reason=(
                            f"Exercise '{e.exercise_name}' requires unavailable equipment "
                            f"'{e.equipment}'."
                        ),
                    )

        return FilterResult(is_eligible=True)


class WorkoutDurationFilter:
    """Enforces that estimated workout duration falls within a coherent acceptable range:

    D_min = max(10, floor(0.50 * D_target))
    D_max = min(120, ceil(1.35 * D_target + 5))
    Candidate passes iff D_min <= D_est <= D_max.
    """

    @property
    def name(self) -> str:
        return "workout_duration"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        payload: WorkoutPayload = candidate.payload
        if not isinstance(payload, WorkoutPayload):
            return FilterResult(is_eligible=False, reason="Invalid candidate payload type.")

        raw_target = context.constraints.target_duration_minutes
        d_target = max(15, min(120, raw_target)) if raw_target is not None else 45

        d_min = max(10, math.floor(0.50 * d_target))
        d_max = min(120, math.ceil(1.35 * d_target + 5.0))

        d_est = payload.estimated_duration_minutes
        if d_est < d_min:
            return FilterResult(
                is_eligible=False,
                reason=(
                    f"Estimated duration ({d_est} min) is below minimum threshold "
                    f"({d_min} min) for target of {d_target} min."
                ),
            )
        if d_est > d_max:
            return FilterResult(
                is_eligible=False,
                reason=(
                    f"Estimated duration ({d_est} min) exceeds maximum threshold "
                    f"({d_max} min) for target of {d_target} min."
                ),
            )

        return FilterResult(is_eligible=True)


class WorkoutStructureFilter:
    """Validates structural integrity of the workout candidate:

    - No duplicate exercise IDs
    - Total sets > 0
    - Minimum 2 exercises for strength; minimum 1 for cardio and mobility.
    """

    @property
    def name(self) -> str:
        return "workout_structure"

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        payload: WorkoutPayload = candidate.payload
        if not isinstance(payload, WorkoutPayload):
            return FilterResult(is_eligible=False, reason="Invalid candidate payload type.")

        if not payload.exercises:
            return FilterResult(is_eligible=False, reason="Workout has zero exercises.")

        if payload.total_sets <= 0:
            return FilterResult(is_eligible=False, reason="Workout has 0 total sets.")

        # Check duplicate exercises
        seen_ids: set[str] = set()
        for e in payload.exercises:
            eid_str = str(e.exercise_id)
            if eid_str in seen_ids:
                return FilterResult(
                    is_eligible=False,
                    reason=f"Duplicate exercise ID '{eid_str}' in workout.",
                )
            seen_ids.add(eid_str)

        # Minimum exercise count check
        min_exercises = 2 if payload.category == "strength" else 1
        if len(payload.exercises) < min_exercises:
            return FilterResult(
                is_eligible=False,
                reason=(
                    f"Workout category '{payload.category}' requires at least "
                    f"{min_exercises} exercises, found {len(payload.exercises)}."
                ),
            )

        return FilterResult(is_eligible=True)
