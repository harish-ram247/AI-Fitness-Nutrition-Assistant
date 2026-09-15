"""Phase 7C – Deterministic Workout Candidate Generator.

Builds structured workout candidates under strict computational bounds:
  - <= 4 candidates when a specific workout_type is requested.
  - <= 28 candidates when workout_type is omitted.
  - Zero uncontrolled Cartesian products.
  - Zero duplicate exercise IDs within any candidate.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exercise import Exercise
from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.types import RecommendationType
from app.recommendations.workouts.models import (
    CANONICAL_WORKOUT_TYPES,
    WORKOUT_TYPE_TO_CATEGORY,
    WorkoutExerciseItem,
    WorkoutPayload,
    build_candidate_id,
    classify_exercise,
    estimate_workout_duration,
    get_primary_equipment_needed,
    normalize_muscle_groups,
)

# ── Template Slot Schemas ───────────────────────────────────────────────────

STRENGTH_TEMPLATES: dict[str, list[str]] = {
    "full_body": ["squat", "hinge", "push", "pull"],
    "upper_body": ["push_horizontal", "pull_horizontal", "push_vertical", "pull_vertical"],
    "lower_body": ["squat", "hinge", "core"],
    "push": ["push_horizontal", "push_vertical", "triceps"],
    "pull": ["hinge", "pull_horizontal", "biceps"],
}


class WorkoutCandidateGenerator:
    """Deterministic candidate generator implementing CandidateGenerator[WorkoutPayload]."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def generate_candidates(
        self, context: RecommendationContext
    ) -> Sequence[RecommendationCandidate[WorkoutPayload]]:
        user_id = context.user_id

        # 1. Fetch active visible exercises
        stmt = (
            select(Exercise)
            .where(
                Exercise.deleted_at.is_(None),
                or_(
                    Exercise.created_by_user_id.is_(None),
                    Exercise.created_by_user_id == user_id,
                ),
            )
            .order_by(
                Exercise.is_verified.desc(),
                Exercise.name.asc(),
                Exercise.id.asc(),
            )
        )
        result = await self.session.execute(stmt)
        all_exercises = list(result.scalars().all())

        # 2. Defense-in-depth equipment filtering on candidate pool
        available_eq = context.constraints.available_equipment
        if available_eq:
            allowed_eq = {"none", "bodyweight"} | {
                eq.strip().lower() for eq in available_eq if eq and eq.strip()
            }
            exercises = [
                e
                for e in all_exercises
                if not e.equipment or e.equipment.strip().lower() in allowed_eq
            ]
        else:
            exercises = all_exercises

        # 3. Classify exercises into movement slot pools
        slot_pools: dict[str, list[Exercise]] = {}
        for ex in exercises:
            slots = classify_exercise(ex)
            for s in slots:
                slot_pools.setdefault(s, []).append(ex)

        # 4. Determine which templates to instantiate
        requested_type = context.constraints.custom_constraints.get("workout_type")
        if requested_type and requested_type in CANONICAL_WORKOUT_TYPES:
            active_types = [requested_type]
        else:
            active_types = [
                "full_body",
                "upper_body",
                "lower_body",
                "push",
                "pull",
                "cardio",
                "mobility",
            ]

        candidates: list[RecommendationCandidate[WorkoutPayload]] = []

        # 5. Generate candidates per active workout type
        for w_type in active_types:
            lineups: list[list[Exercise]] = []

            if w_type in STRENGTH_TEMPLATES:
                lineups = self._generate_strength_lineups(w_type, slot_pools)
            elif w_type == "cardio":
                lineups = self._generate_cardio_lineups(slot_pools.get("cardio", []))
            elif w_type == "mobility":
                lineups = self._generate_mobility_lineups(exercises)

            # Each lineup is instantiated under both canonical variants
            for lineup in lineups:
                for variant in ("standard", "density"):
                    candidate = self._build_candidate(w_type, variant, lineup)
                    candidates.append(candidate)

        # 6. Hard Invariant Assertions
        if requested_type and requested_type in CANONICAL_WORKOUT_TYPES:
            assert len(candidates) <= 4, f"Single workout type exceeded 4: {len(candidates)}"
        else:
            assert len(candidates) <= 28, f"Candidate pool exceeded 28: {len(candidates)}"

        return candidates

    def _generate_strength_lineups(
        self,
        workout_type: str,
        slot_pools: dict[str, list[Exercise]],
    ) -> list[list[Exercise]]:
        """Generate at most 2 distinct lineups for a strength template."""
        slots = STRENGTH_TEMPLATES[workout_type]

        # Verify all slots have at least 1 exercise
        for s in slots:
            if not slot_pools.get(s):
                return []

        # Lineup 1 (Primary): Greedily pick first distinct exercise per slot
        lineup_1: list[Exercise] = []
        chosen_1: set[str] = set()

        for s in slots:
            pool = slot_pools[s]
            found = False
            for ex in pool:
                ex_id_str = str(ex.id)
                if ex_id_str not in chosen_1:
                    lineup_1.append(ex)
                    chosen_1.add(ex_id_str)
                    found = True
                    break
            if not found:
                # Could not form a distinct lineup
                return []

        lineups = [lineup_1]

        # Lineup 2 (Alternate): Attempt index-1 substitution
        lineup_2: list[Exercise] = []
        chosen_2: set[str] = set()

        for s in slots:
            pool = slot_pools[s]
            # Try index 1 first if available, else index 0, ensuring distinctness
            candidates_to_try = pool[1:] + pool[:1] if len(pool) >= 2 else pool
            found = False
            for ex in candidates_to_try:
                ex_id_str = str(ex.id)
                if ex_id_str not in chosen_2:
                    lineup_2.append(ex)
                    chosen_2.add(ex_id_str)
                    found = True
                    break
            if not found:
                break

        if len(lineup_2) == len(slots):
            # Check distinctness from lineup 1
            ids_1 = [e.id for e in lineup_1]
            ids_2 = [e.id for e in lineup_2]
            if ids_1 != ids_2:
                lineups.append(lineup_2)

        return lineups

    def _generate_cardio_lineups(self, cardio_pool: list[Exercise]) -> list[list[Exercise]]:
        """Generate cardio lineups handling 0, 1, 2, and >= 3 exercises."""
        c = cardio_pool
        n = len(c)
        if n == 0:
            return []
        if n == 1:
            return [[c[0]]]
        if n == 2:
            return [[c[0], c[1]]]
        # n >= 3
        return [[c[0], c[1]], [c[0], c[2]]]

    def _generate_mobility_lineups(self, exercises: list[Exercise]) -> list[list[Exercise]]:
        """Generate mobility lineups strictly from flexibility and balance exercises."""
        flex_exercises = [
            e
            for e in exercises
            if e.category and e.category.strip().lower() in {"flexibility", "balance"}
        ]
        n = len(flex_exercises)
        if n == 0:
            return []
        if n == 1:
            return [[flex_exercises[0]]]
        if n == 2:
            return [[flex_exercises[0], flex_exercises[1]]]

        # Partition into upper, lower, core
        f_upper: list[Exercise] = []
        f_lower: list[Exercise] = []
        f_core: list[Exercise] = []

        for ex in flex_exercises:
            slots = classify_exercise(ex)
            if "mobility_upper" in slots:
                f_upper.append(ex)
            elif "mobility_lower" in slots:
                f_lower.append(ex)
            elif "mobility_core" in slots:
                f_core.append(ex)

        # Lineup 1 (Primary): Up to 3 distinct exercises
        lineup_1: list[Exercise] = []
        chosen_1: set[str] = set()

        def _pick_next(pool: list[Exercise]) -> None:
            for ex in pool:
                ex_id = str(ex.id)
                if ex_id not in chosen_1:
                    lineup_1.append(ex)
                    chosen_1.add(ex_id)
                    return

        # Slot 1: upper or fallback
        _pick_next(f_upper or flex_exercises)
        # Slot 2: lower or fallback
        _pick_next(f_lower or flex_exercises)
        # Slot 3: core or fallback
        _pick_next(f_core or flex_exercises)

        if not lineup_1:
            return []

        lineups = [lineup_1]

        # Lineup 2 (Alternate): Generated only if >= 4 flexibility exercises exist
        if n >= 4:
            lineup_2: list[Exercise] = []
            chosen_2: set[str] = set()

            def _pick_next_2(pool: list[Exercise]) -> None:
                # Try index 1 onwards first
                for ex in pool[1:] if len(pool) >= 2 else pool:
                    ex_id = str(ex.id)
                    if ex_id not in chosen_2:
                        lineup_2.append(ex)
                        chosen_2.add(ex_id)
                        return
                # Fallback to any unused in flex_exercises
                for ex in flex_exercises:
                    ex_id = str(ex.id)
                    if ex_id not in chosen_2:
                        lineup_2.append(ex)
                        chosen_2.add(ex_id)
                        return

            _pick_next_2(f_upper or flex_exercises)
            _pick_next_2(f_lower or flex_exercises)
            _pick_next_2(f_core or flex_exercises)

            if len(lineup_2) == len(lineup_1):
                ids_1 = [e.id for e in lineup_1]
                ids_2 = [e.id for e in lineup_2]
                if ids_1 != ids_2:
                    lineups.append(lineup_2)

        return lineups

    def _build_candidate(
        self,
        workout_type: str,
        variant: str,
        exercises: list[Exercise],
    ) -> RecommendationCandidate[WorkoutPayload]:
        """Instantiate a structured WorkoutPayload candidate under the given variant."""
        category = WORKOUT_TYPE_TO_CATEGORY[workout_type]

        # Determine programming parameters per category and variant
        if category == "strength":
            if variant == "standard":
                sets, reps, dur, rest = 3, 10, None, 90
            else:  # density
                sets, reps, dur, rest = 4, 8, None, 60
        elif category == "cardio":
            if variant == "standard":
                sets, reps, dur, rest = 3, None, 300, 60
            else:  # density
                sets, reps, dur, rest = 4, None, 300, 45
        else:  # mobility
            if variant == "standard":
                sets, reps, dur, rest = 3, None, 45, 30
            else:  # density
                sets, reps, dur, rest = 4, None, 60, 30

        exercise_items: list[WorkoutExerciseItem] = []
        for i, ex in enumerate(exercises):
            exercise_items.append(
                WorkoutExerciseItem(
                    exercise_id=ex.id,
                    exercise_name=ex.name,
                    category=ex.category,
                    muscle_groups=list(ex.muscle_groups or []),
                    equipment=ex.equipment,
                    order_index=i,
                    recommended_sets=sets,
                    recommended_reps=reps,
                    recommended_duration_seconds=dur,
                    recommended_rest_seconds=rest,
                )
            )

        # Collect target muscle groups (normalized, deduplicated, sorted)
        all_muscles: set[str] = set()
        for ex in exercises:
            all_muscles |= normalize_muscle_groups(ex.muscle_groups)
        target_muscle_groups = sorted(all_muscles)

        estimated_duration = estimate_workout_duration(exercise_items)
        total_sets = sets * len(exercise_items)
        primary_equipment = get_primary_equipment_needed(exercise_items)

        # Human-readable title
        title_prefix = workout_type.replace("_", " ").title()
        title_variant = "Standard" if variant == "standard" else "Density"
        name = f"{title_prefix} ({title_variant})"

        payload = WorkoutPayload(
            name=name,
            workout_type=workout_type,
            category=category,
            target_muscle_groups=target_muscle_groups,
            exercises=exercise_items,
            estimated_duration_minutes=estimated_duration,
            total_sets=total_sets,
            primary_equipment_needed=primary_equipment,
            variant=variant,
        )

        cand_id = build_candidate_id(workout_type, variant, exercise_items)

        return RecommendationCandidate[WorkoutPayload](
            id=cand_id,
            recommendation_type=RecommendationType.WORKOUT,
            payload=payload,
        )
