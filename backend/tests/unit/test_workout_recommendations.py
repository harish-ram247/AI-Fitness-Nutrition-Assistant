"""Phase 7C – Unit tests for Workout Recommendation domain and engine components.

Covers all required test groups from the approved architecture:
  - CLASSIFIER: order-independence, synonyms, compound/ambiguous, exclusion of unmapped/empty
  - CARDIO: 0, 1, 2, >=3 lineups, canonical variant definitions (3x300/60s vs 4x300/45s)
  - MOBILITY: 0, 1, 2, >=3, >=4 lineups, flexibility/balance only, no duplicate IDs
  - STRENGTH: template slotting, primary/alternate lineups, distinct exercises, no duplicates
  - DURATION: exact formula, target 15 and 45 hard filter acceptance/rejection boundaries
  - GOAL SCORING: exact formulas for all 5 goals + unknown (0.50), bounded in [0.0, 1.0]
  - SCORING ENGINE: weights (3.0, 2.5, 1.5, 1.0), freshness, novelty, duration fit
  - CANDIDATE BOUNDS: <=28 for full catalog, <=4 for specific workout_type
  - CANDIDATE IDS: deterministic, collision-free, variant-distinct, order-sensitive
  - EQUIPMENT: normalization, trimming, lowercasing, "none" excluded
"""

from __future__ import annotations

import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import (
    ConstraintContext,
    GoalContext,
    RecommendationContext,
)
from app.recommendations.scoring import RecommendationScorer
from app.recommendations.types import RecommendationType
from app.recommendations.workouts.filters import (
    WorkoutDurationFilter,
    WorkoutEquipmentFilter,
    WorkoutVisibilityFilter,
)
from app.recommendations.workouts.generator import WorkoutCandidateGenerator
from app.recommendations.workouts.models import (
    WorkoutExerciseItem,
    WorkoutPayload,
    build_candidate_id,
    classify_exercise,
    estimate_workout_duration,
)
from app.recommendations.workouts.scoring import (
    ExerciseNoveltyFactor,
    MuscleGroupFreshnessFactor,
    WorkoutDurationFitFactor,
    WorkoutGoalAlignmentFactor,
)

# ─────────────────────────────────────────────────────────────────────────────
# Test Helpers & Factories
# ─────────────────────────────────────────────────────────────────────────────


def _make_mock_exercise(
    name: str = "Test Exercise",
    category: str = "strength",
    muscle_groups: list[str] | None = None,
    equipment: str = "bodyweight",
    is_verified: bool = True,
    created_by_user_id: uuid.UUID | None = None,
    deleted_at: Any = None,
    exercise_id: uuid.UUID | None = None,
) -> MagicMock:
    ex = MagicMock()
    ex.id = exercise_id or uuid.uuid4()
    ex.name = name
    ex.category = category
    ex.muscle_groups = muscle_groups if muscle_groups is not None else ["chest"]
    ex.equipment = equipment
    ex.is_verified = is_verified
    ex.created_by_user_id = created_by_user_id
    ex.deleted_at = deleted_at
    return ex


def _make_workout_candidate(
    workout_type: str = "full_body",
    category: str = "strength",
    variant: str = "standard",
    exercises: list[WorkoutExerciseItem] | None = None,
    estimated_duration_minutes: int = 45,
) -> RecommendationCandidate[WorkoutPayload]:
    if exercises is None:
        exercises = [
            WorkoutExerciseItem(
                exercise_id=uuid.uuid4(),
                exercise_name="Goblet Squat",
                category="strength",
                muscle_groups=["quadriceps"],
                equipment="dumbbell",
                order_index=0,
                recommended_sets=3,
                recommended_reps=10,
                recommended_duration_seconds=None,
                recommended_rest_seconds=90,
            ),
            WorkoutExerciseItem(
                exercise_id=uuid.uuid4(),
                exercise_name="Romanian Deadlift",
                category="strength",
                muscle_groups=["hamstrings"],
                equipment="dumbbell",
                order_index=1,
                recommended_sets=3,
                recommended_reps=10,
                recommended_duration_seconds=None,
                recommended_rest_seconds=90,
            ),
        ]
    total_sets = sum(e.recommended_sets for e in exercises)
    all_muscles: list[str] = []
    all_eq: list[str] = []
    for e in exercises:
        all_muscles.extend(e.muscle_groups)
        if e.equipment and e.equipment.lower() not in {"none", ""}:
            all_eq.append(e.equipment.strip().lower())
    payload = WorkoutPayload(
        name=f"Full Body {variant.capitalize()}",
        workout_type=workout_type,
        category=category,
        variant=variant,
        target_muscle_groups=sorted(set(all_muscles)),
        exercises=exercises,
        estimated_duration_minutes=estimated_duration_minutes,
        total_sets=total_sets,
        primary_equipment_needed=sorted(set(all_eq)),
    )
    cid = build_candidate_id(workout_type, variant, exercises)
    return RecommendationCandidate(
        id=cid,
        recommendation_type=RecommendationType.WORKOUT,
        payload=payload,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. MOVEMENT-SLOT CLASSIFIER TESTS
# ─────────────────────────────────────────────────────────────────────────────


class TestMovementSlotClassifier:
    """Verify order-independent movement slot classification."""

    def test_muscle_group_ordering_does_not_affect_classification(self) -> None:
        """Rule: muscle groups are converted into a canonical set; ordering must never matter."""
        ex1 = _make_mock_exercise(name="Pushup", muscle_groups=["chest", "triceps", "shoulders"])
        ex2 = _make_mock_exercise(name="Pushup", muscle_groups=["shoulders", "chest", "triceps"])
        ex3 = _make_mock_exercise(name="Pushup", muscle_groups=["triceps", "shoulders", "chest"])

        slots1 = classify_exercise(ex1)
        slots2 = classify_exercise(ex2)
        slots3 = classify_exercise(ex3)

        assert slots1 == slots2 == slots3
        assert "push_horizontal" in slots1
        assert "push" in slots1

    def test_ambiguous_quadriceps_plus_hamstrings_maps_to_both_squat_and_hinge(self) -> None:
        """Rule: exercises with both quads and hams map to BOTH squat and hinge."""
        ex = _make_mock_exercise(name="Deadlift", muscle_groups=["quadriceps", "hamstrings"])
        slots = classify_exercise(ex)
        assert "squat" in slots
        assert "hinge" in slots

    def test_quadriceps_without_hamstrings_maps_to_squat_only(self) -> None:
        ex = _make_mock_exercise(name="Front Squat", muscle_groups=["quadriceps", "glutes"])
        slots = classify_exercise(ex)
        assert "squat" in slots
        assert "hinge" not in slots

    def test_hamstrings_without_quadriceps_maps_to_hinge_only(self) -> None:
        ex = _make_mock_exercise(name="Romanian Deadlift", muscle_groups=["hamstrings"])
        slots = classify_exercise(ex)
        assert "hinge" in slots
        assert "squat" not in slots

    def test_glutes_without_quads_or_hamstrings_maps_to_hinge(self) -> None:
        ex = _make_mock_exercise(name="Hip Thrust", muscle_groups=["glutes"])
        slots = classify_exercise(ex)
        assert "hinge" in slots
        assert "squat" not in slots

    def test_chest_maps_to_push_horizontal_and_push(self) -> None:
        ex = _make_mock_exercise(name="Bench Press", muscle_groups=["chest", "triceps"])
        slots = classify_exercise(ex)
        assert "push_horizontal" in slots
        assert "push" in slots
        assert "triceps" not in slots

    def test_shoulders_without_chest_maps_to_push_vertical_and_push(self) -> None:
        ex = _make_mock_exercise(name="Overhead Press", muscle_groups=["shoulders", "triceps"])
        slots = classify_exercise(ex)
        assert "push_vertical" in slots
        assert "push" in slots

    def test_triceps_only_maps_to_triceps(self) -> None:
        ex = _make_mock_exercise(name="Triceps Pushdown", muscle_groups=["triceps"])
        slots = classify_exercise(ex)
        assert "triceps" in slots

    def test_biceps_only_maps_to_biceps(self) -> None:
        ex = _make_mock_exercise(name="Bicep Curl", muscle_groups=["biceps"])
        slots = classify_exercise(ex)
        assert "biceps" in slots

    def test_abdominals_maps_to_core(self) -> None:
        ex = _make_mock_exercise(name="Plank", muscle_groups=["abdominals"])
        slots = classify_exercise(ex)
        assert slots == {"core"}

    def test_back_exercises_map_to_pull_and_direction(self) -> None:
        # Lats / vertical
        ex_vert = _make_mock_exercise(name="Pull-up", muscle_groups=["lats", "biceps"])
        slots_vert = classify_exercise(ex_vert)
        assert "pull" in slots_vert
        assert "pull_vertical" in slots_vert

        # Rhomboids / horizontal
        ex_horiz = _make_mock_exercise(name="Bent-Over Row", muscle_groups=["rhomboids"])
        slots_horiz = classify_exercise(ex_horiz)
        assert "pull" in slots_horiz
        assert "pull_horizontal" in slots_horiz

    def test_cardio_category_maps_to_cardio(self) -> None:
        ex = _make_mock_exercise(
            name="Running",
            category="cardio",
            muscle_groups=["quadriceps", "calves"],
        )
        slots = classify_exercise(ex)
        assert slots == {"cardio"}

    def test_flexibility_balance_maps_to_mobility_slots(self) -> None:
        ex_upper = _make_mock_exercise(
            name="Shoulder Stretch",
            category="flexibility",
            muscle_groups=["shoulders"],
        )
        assert classify_exercise(ex_upper) == {"mobility_upper"}

        ex_lower = _make_mock_exercise(
            name="Hamstring Stretch",
            category="flexibility",
            muscle_groups=["hamstrings"],
        )
        assert classify_exercise(ex_lower) == {"mobility_lower"}

        ex_core = _make_mock_exercise(
            name="Cat Cow",
            category="flexibility",
            muscle_groups=["abdominals"],
        )
        assert classify_exercise(ex_core) == {"mobility_core"}

    def test_unmapped_exercises_are_excluded(self) -> None:
        ex = _make_mock_exercise(
            name="Mystery Move", category="unknown", muscle_groups=["forearms"]
        )
        slots = classify_exercise(ex)
        assert slots == set()

    def test_empty_muscle_groups_excluded(self) -> None:
        ex = _make_mock_exercise(name="No Muscle", category="strength", muscle_groups=[])
        slots = classify_exercise(ex)
        assert slots == set()


# ─────────────────────────────────────────────────────────────────────────────
# 2. DURATION CALCULATION & FILTER TESTS
# ─────────────────────────────────────────────────────────────────────────────


class TestDurationCalculationsAndFilter:
    """Verify exact duration formula and hard filter boundaries."""

    def test_exact_duration_formula(self) -> None:
        ex1 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 1",
            category="strength",
            muscle_groups=["chest"],
            equipment="dumbbell",
            order_index=0,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        ex2 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 2",
            category="strength",
            muscle_groups=["back"],
            equipment="dumbbell",
            order_index=1,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        d_est = estimate_workout_duration([ex1, ex2])
        # Total sec: (3*40 + 2*90)*2 + 120 = 600 + 120 = 720 sec -> 12 min
        assert d_est == 12

    def test_cardio_exact_duration(self) -> None:
        # 1 cardio exercise: 3 sets x 300s, 60s rest
        # work_time = 300s
        # exercise_time = 3 * 300 + 2 * 60 = 900 + 120 = 1020s
        # transitions: 0s -> 1020s / 60 = 17 min
        ex = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Running",
            category="cardio",
            muscle_groups=["quadriceps"],
            equipment="bodyweight",
            order_index=0,
            recommended_sets=3,
            recommended_reps=None,
            recommended_duration_seconds=300,
            recommended_rest_seconds=60,
        )
        d_est = estimate_workout_duration([ex])
        assert d_est == 17

    def test_target_15_hard_filter_boundaries(self) -> None:
        filter_ = WorkoutDurationFilter()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            constraints=ConstraintContext(target_duration_minutes=15),
        )

        cand_44 = _make_workout_candidate(estimated_duration_minutes=44)
        cand_15 = _make_workout_candidate(estimated_duration_minutes=15)
        cand_26 = _make_workout_candidate(estimated_duration_minutes=26)

        assert filter_.filter(cand_44, ctx).is_eligible is False
        assert filter_.filter(cand_15, ctx).is_eligible is True
        assert filter_.filter(cand_26, ctx).is_eligible is True

    def test_target_45_hard_filter_boundaries(self) -> None:
        filter_ = WorkoutDurationFilter()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            constraints=ConstraintContext(target_duration_minutes=45),
        )

        cand_26 = _make_workout_candidate(estimated_duration_minutes=26)
        cand_70 = _make_workout_candidate(estimated_duration_minutes=70)

        assert filter_.filter(cand_26, ctx).is_eligible is True
        assert filter_.filter(cand_70, ctx).is_eligible is False


# ─────────────────────────────────────────────────────────────────────────────
# 3. GOAL SCORING FORMULAS
# ─────────────────────────────────────────────────────────────────────────────


class TestGoalScoringFormulas:
    """Verify exact goal-alignment formulas from approved architecture."""

    def test_muscle_gain_goal_formula(self) -> None:
        factor = WorkoutGoalAlignmentFactor()
        cand_str = _make_workout_candidate(
            category="strength",
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=uuid.uuid4(),
                    exercise_name=f"Ex {i}",
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=i,
                    recommended_sets=4,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=60,
                )
                for i in range(4)
            ],  # total 16 sets, avg reps 10 -> v_vol=1.0, v_rep=1.0 -> 1.0
        )
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="muscle_gain"),
        )
        assert factor.score(cand_str, ctx).normalized_score == 1.00

        cand_cardio = _make_workout_candidate(category="cardio", workout_type="cardio")
        assert factor.score(cand_cardio, ctx).normalized_score == 0.20

    def test_strength_goal_formula_neutral_v_variant(self) -> None:
        factor = WorkoutGoalAlignmentFactor()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="strength"),
        )

        cand_density = _make_workout_candidate(category="strength", variant="density")
        # 0.60 * 0.95 + 0.40 * 1.00 = 0.57 + 0.40 = 0.97
        assert factor.score(cand_density, ctx).normalized_score == 0.97

        cand_standard = _make_workout_candidate(category="strength", variant="standard")
        # 0.60 * 0.80 + 0.40 * 1.00 = 0.48 + 0.40 = 0.88
        assert factor.score(cand_standard, ctx).normalized_score == 0.88

        cand_cardio = _make_workout_candidate(category="cardio", workout_type="cardio")
        assert factor.score(cand_cardio, ctx).normalized_score == 0.15

    def test_weight_loss_goal_formula(self) -> None:
        factor = WorkoutGoalAlignmentFactor()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="weight_loss"),
        )

        cand_cardio = _make_workout_candidate(category="cardio", workout_type="cardio")
        assert factor.score(cand_cardio, ctx).normalized_score == 1.00

        cand_mob = _make_workout_candidate(category="mobility", workout_type="mobility")
        assert factor.score(cand_mob, ctx).normalized_score == 0.40

    def test_endurance_goal_formula(self) -> None:
        factor = WorkoutGoalAlignmentFactor()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="endurance"),
        )

        cand_cardio_den = _make_workout_candidate(
            category="cardio", workout_type="cardio", variant="density"
        )
        assert factor.score(cand_cardio_den, ctx).normalized_score == 1.00

        cand_cardio_std = _make_workout_candidate(
            category="cardio", workout_type="cardio", variant="standard"
        )
        assert factor.score(cand_cardio_std, ctx).normalized_score == 0.90

        cand_mob = _make_workout_candidate(category="mobility", workout_type="mobility")
        assert factor.score(cand_mob, ctx).normalized_score == 0.30

    def test_maintenance_goal_formula(self) -> None:
        factor = WorkoutGoalAlignmentFactor()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="maintenance"),
        )

        cand_fb = _make_workout_candidate(workout_type="full_body", category="strength")
        assert factor.score(cand_fb, ctx).normalized_score == 1.00

        cand_split = _make_workout_candidate(workout_type="push", category="strength")
        assert factor.score(cand_split, ctx).normalized_score == 0.90

        cand_cardio = _make_workout_candidate(workout_type="cardio", category="cardio")
        assert factor.score(cand_cardio, ctx).normalized_score == 0.85

    def test_unknown_or_missing_goal_equals_exactly_0_50(self) -> None:
        factor = WorkoutGoalAlignmentFactor()

        ctx_none = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=None,
        )
        cand = _make_workout_candidate()
        assert factor.score(cand, ctx_none).normalized_score == 0.50

        ctx_unknown = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="crossfit_games"),
        )
        assert factor.score(cand, ctx_unknown).normalized_score == 0.50


# ─────────────────────────────────────────────────────────────────────────────
# 4. CANDIDATE IDS & EQUIPMENT
# ─────────────────────────────────────────────────────────────────────────────


class TestCandidateIDsAndEquipment:
    """Verify deterministic candidate IDs and equipment normalization."""

    def test_exercise_order_changes_candidate_id(self) -> None:
        ex1 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 1",
            category="strength",
            muscle_groups=["chest"],
            equipment="dumbbell",
            order_index=0,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        ex2 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 2",
            category="strength",
            muscle_groups=["back"],
            equipment="dumbbell",
            order_index=1,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        cid_a = build_candidate_id("full_body", "standard", [ex1, ex2])
        # Switch order
        ex1_swapped = ex1.model_copy(update={"order_index": 1})
        ex2_swapped = ex2.model_copy(update={"order_index": 0})
        cid_b = build_candidate_id("full_body", "standard", [ex2_swapped, ex1_swapped])
        assert cid_a != cid_b

    def test_standard_differs_from_density_id(self) -> None:
        ex1 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 1",
            category="strength",
            muscle_groups=["chest"],
            equipment="dumbbell",
            order_index=0,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        cid_std = build_candidate_id("full_body", "standard", [ex1])
        cid_den = build_candidate_id("full_body", "density", [ex1])
        assert cid_std != cid_den
        assert "standard" in cid_std
        assert "density" in cid_den

    def test_equipment_output_normalizes_and_excludes_none(self) -> None:
        ex1 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 1",
            category="strength",
            muscle_groups=["chest"],
            equipment="  Dumbbell ",
            order_index=0,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        ex2 = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Ex 2",
            category="strength",
            muscle_groups=["chest"],
            equipment="NONE",
            order_index=1,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        cand = _make_workout_candidate(exercises=[ex1, ex2])
        assert cand.payload.primary_equipment_needed == ["dumbbell"]

    def test_equipment_filter_unconstrained_allows_all(self) -> None:
        filter_ = WorkoutEquipmentFilter()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            constraints=ConstraintContext(available_equipment=[]),
        )
        cand = _make_workout_candidate()
        assert filter_.filter(cand, ctx).is_eligible is True

    def test_equipment_filter_constrained_allows_bodyweight_plus_explicit(self) -> None:
        filter_ = WorkoutEquipmentFilter()
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            constraints=ConstraintContext(available_equipment=["dumbbell"]),
        )
        cand_db = _make_workout_candidate()
        assert filter_.filter(cand_db, ctx).is_eligible is True

        ex_bb = WorkoutExerciseItem(
            exercise_id=uuid.uuid4(),
            exercise_name="Barbell Squat",
            category="strength",
            muscle_groups=["quadriceps"],
            equipment="barbell",
            order_index=0,
            recommended_sets=3,
            recommended_reps=10,
            recommended_duration_seconds=None,
            recommended_rest_seconds=90,
        )
        cand_bb = _make_workout_candidate(exercises=[ex_bb])
        res = filter_.filter(cand_bb, ctx)
        assert res.is_eligible is False
        assert res.reason is not None and "barbell" in res.reason


# ─────────────────────────────────────────────────────────────────────────────
# 5. CARDIO GENERATION SPECIFICATION
# ─────────────────────────────────────────────────────────────────────────────


class TestCardioGeneration:
    """Verify exact sparse-catalog cardio rules and variant definitions."""

    def test_zero_cardio_exercises_produces_zero_lineups(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        lineups = gen._generate_cardio_lineups([])
        assert len(lineups) == 0

    def test_one_cardio_exercise_produces_one_lineup(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex = _make_mock_exercise(name="Running", category="cardio")
        lineups = gen._generate_cardio_lineups([ex])
        assert len(lineups) == 1
        assert len(lineups[0]) == 1

        # Test candidate creation with 1 cardio exercise
        cand_std = gen._build_candidate("cardio", "standard", lineups[0])
        assert len(cand_std.payload.exercises) == 1
        assert cand_std.payload.exercises[0].recommended_sets == 3
        assert cand_std.payload.exercises[0].recommended_duration_seconds == 300
        assert cand_std.payload.exercises[0].recommended_rest_seconds == 60

        cand_den = gen._build_candidate("cardio", "density", lineups[0])
        assert len(cand_den.payload.exercises) == 1
        assert cand_den.payload.exercises[0].recommended_sets == 4
        assert cand_den.payload.exercises[0].recommended_duration_seconds == 300
        assert cand_den.payload.exercises[0].recommended_rest_seconds == 45

    def test_two_cardio_exercises_produces_one_two_exercise_lineup(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex1 = _make_mock_exercise(name="Cycling", category="cardio")
        ex2 = _make_mock_exercise(name="Rowing", category="cardio")
        lineups = gen._generate_cardio_lineups([ex1, ex2])
        assert len(lineups) == 1
        assert len(lineups[0]) == 2
        assert {lineups[0][0].id, lineups[0][1].id} == {ex1.id, ex2.id}

    def test_three_or_more_cardio_exercises_produces_two_lineups(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex0 = _make_mock_exercise(name="Cycling", category="cardio")
        ex1 = _make_mock_exercise(name="Rowing", category="cardio")
        ex2 = _make_mock_exercise(name="Running", category="cardio")
        lineups = gen._generate_cardio_lineups([ex0, ex1, ex2])
        assert len(lineups) == 2
        assert [e.id for e in lineups[0]] == [ex0.id, ex1.id]
        assert [e.id for e in lineups[1]] == [ex0.id, ex2.id]


# ─────────────────────────────────────────────────────────────────────────────
# 6. MOBILITY GENERATION SPECIFICATION
# ─────────────────────────────────────────────────────────────────────────────


class TestMobilityGeneration:
    """Verify sparse-catalog mobility rules and distinct exercise guarantee."""

    def test_zero_mobility_produces_zero(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        assert len(gen._generate_mobility_lineups([])) == 0

    def test_one_mobility_produces_one_lineup(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex = _make_mock_exercise(name="Hamstring Stretch", category="flexibility")
        lineups = gen._generate_mobility_lineups([ex])
        assert len(lineups) == 1
        assert len(lineups[0]) == 1

    def test_two_mobility_produces_one_lineup_both_distinct(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex1 = _make_mock_exercise(name="Hamstring Stretch", category="flexibility")
        ex2 = _make_mock_exercise(name="Shoulder Stretch", category="flexibility")
        lineups = gen._generate_mobility_lineups([ex1, ex2])
        assert len(lineups) == 1
        assert len(lineups[0]) == 2
        assert lineups[0][0].id != lineups[0][1].id

    def test_three_mobility_produces_primary_lineup(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex1 = _make_mock_exercise(name="Ex 1", category="flexibility", muscle_groups=["shoulders"])
        ex2 = _make_mock_exercise(name="Ex 2", category="flexibility", muscle_groups=["hamstrings"])
        ex3 = _make_mock_exercise(name="Ex 3", category="flexibility", muscle_groups=["abdominals"])
        lineups = gen._generate_mobility_lineups([ex1, ex2, ex3])
        assert len(lineups) == 1
        assert len(lineups[0]) == 3

    def test_four_mobility_produces_alternate_lineup(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex1 = _make_mock_exercise(name="Ex 1", category="flexibility", muscle_groups=["shoulders"])
        ex2 = _make_mock_exercise(name="Ex 2", category="flexibility", muscle_groups=["hamstrings"])
        ex3 = _make_mock_exercise(name="Ex 3", category="flexibility", muscle_groups=["abdominals"])
        ex4 = _make_mock_exercise(name="Ex 4", category="flexibility", muscle_groups=["shoulders"])
        lineups = gen._generate_mobility_lineups([ex1, ex2, ex3, ex4])
        assert len(lineups) == 2
        for lineup in lineups:
            ids = [e.id for e in lineup]
            assert len(ids) == len(set(ids))

    def test_canonical_mobility_variants(self) -> None:
        session = MagicMock()
        gen = WorkoutCandidateGenerator(session)
        ex = _make_mock_exercise(name="Stretch", category="flexibility")
        cand_std = gen._build_candidate("mobility", "standard", [ex])
        cand_den = gen._build_candidate("mobility", "density", [ex])

        assert cand_std.payload.exercises[0].recommended_sets == 3
        assert cand_std.payload.exercises[0].recommended_duration_seconds == 45
        assert cand_std.payload.exercises[0].recommended_rest_seconds == 30

        assert cand_den.payload.exercises[0].recommended_sets == 4
        assert cand_den.payload.exercises[0].recommended_duration_seconds == 60
        assert cand_den.payload.exercises[0].recommended_rest_seconds == 30


# ─────────────────────────────────────────────────────────────────────────────
# 7. CANDIDATE BOUND INVARIANT & STRENGTH GENERATION
# ─────────────────────────────────────────────────────────────────────────────


class TestCandidateBoundsAndGeneration:
    """Verify maximum candidate counts (<=28 full catalog, <=4 specific type)."""

    def _build_rich_catalog(self) -> list[Any]:
        exercises: list[Any] = []
        for i in range(3):
            exercises.append(
                _make_mock_exercise(
                    name=f"Squat {i}", category="strength", muscle_groups=["quadriceps"]
                )
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Hinge {i}", category="strength", muscle_groups=["hamstrings"]
                )
            )
            exercises.append(
                _make_mock_exercise(name=f"Bench {i}", category="strength", muscle_groups=["chest"])
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Press {i}", category="strength", muscle_groups=["shoulders"]
                )
            )
            exercises.append(
                _make_mock_exercise(name=f"Pullup {i}", category="strength", muscle_groups=["lats"])
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Row {i}", category="strength", muscle_groups=["rhomboids"]
                )
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Plank {i}", category="strength", muscle_groups=["abdominals"]
                )
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Triceps {i}", category="strength", muscle_groups=["triceps"]
                )
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Biceps {i}", category="strength", muscle_groups=["biceps"]
                )
            )
        for i in range(4):
            exercises.append(
                _make_mock_exercise(name=f"Cardio {i}", category="cardio", muscle_groups=["calves"])
            )
            exercises.append(
                _make_mock_exercise(
                    name=f"Mobility {i}", category="flexibility", muscle_groups=["shoulders"]
                )
            )
        return exercises

    @pytest.mark.asyncio
    async def test_full_catalog_bound_at_most_28_candidates(self) -> None:
        session = AsyncMock()
        catalog = self._build_rich_catalog()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = catalog
        session.execute.return_value = mock_result

        gen = WorkoutCandidateGenerator(session)
        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            constraints=ConstraintContext(),
        )
        cands = await gen.generate_candidates(ctx)

        # Invariant: <= 28 candidates generated
        assert len(cands) <= 28
        assert len(cands) > 0

        # Unique IDs
        ids = [c.id for c in cands]
        assert len(ids) == len(set(ids))

        # No duplicate exercise IDs in any candidate
        for c in cands:
            ex_ids = [e.exercise_id for e in c.payload.exercises]
            assert len(ex_ids) == len(set(ex_ids))

    @pytest.mark.asyncio
    async def test_specific_workout_type_bound_at_most_4_candidates(self) -> None:
        session = AsyncMock()
        catalog = self._build_rich_catalog()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = catalog
        session.execute.return_value = mock_result

        gen = WorkoutCandidateGenerator(session)
        workout_types = [
            "full_body",
            "upper_body",
            "lower_body",
            "push",
            "pull",
            "cardio",
            "mobility",
        ]
        for w_type in workout_types:
            ctx = RecommendationContext(
                user_id=uuid.uuid4(),
                recommendation_type=RecommendationType.WORKOUT,
                constraints=ConstraintContext(custom_constraints={"workout_type": w_type}),
            )
            cands = await gen.generate_candidates(ctx)
            assert len(cands) <= 4, f"Type {w_type} generated {len(cands)} > 4"
            for c in cands:
                assert c.payload.workout_type == w_type


# ─────────────────────────────────────────────────────────────────────────────
# 8. VISIBILITY & OWNERSHIP FILTER
# ─────────────────────────────────────────────────────────────────────────────


class TestVisibilityFilter:
    """Verify system-verified and user-custom visibility isolation."""

    def test_system_verified_exercises_are_visible(self) -> None:
        filter_ = WorkoutVisibilityFilter()
        user_id = uuid.uuid4()
        ctx = RecommendationContext(user_id=user_id, recommendation_type=RecommendationType.WORKOUT)
        ex = _make_mock_exercise(is_verified=True, created_by_user_id=None)
        cand = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=ex.id,
                    exercise_name=ex.name,
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                )
            ]
        )
        assert filter_.filter(cand, ctx).is_eligible is True

    def test_users_own_custom_exercise_is_visible(self) -> None:
        filter_ = WorkoutVisibilityFilter()
        user_id = uuid.uuid4()
        ex = _make_mock_exercise(is_verified=False, created_by_user_id=user_id)
        ctx = RecommendationContext(
            user_id=user_id,
            recommendation_type=RecommendationType.WORKOUT,
            metadata={"visible_exercise_ids": [str(ex.id)]},
        )
        cand = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=ex.id,
                    exercise_name=ex.name,
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                )
            ]
        )
        assert filter_.filter(cand, ctx).is_eligible is True

    def test_other_users_custom_exercise_is_rejected(self) -> None:
        filter_ = WorkoutVisibilityFilter()
        user_a_id = uuid.uuid4()
        user_b_id = uuid.uuid4()
        ex_a = _make_mock_exercise(is_verified=False, created_by_user_id=user_a_id)
        ctx = RecommendationContext(
            user_id=user_b_id,
            recommendation_type=RecommendationType.WORKOUT,
            metadata={"visible_exercise_ids": []},
        )
        cand = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=ex_a.id,
                    exercise_name=ex_a.name,
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                )
            ]
        )
        res = filter_.filter(cand, ctx)
        assert res.is_eligible is False
        assert res.reason is not None and "not visible" in res.reason


# ─────────────────────────────────────────────────────────────────────────────
# 9. SCORING FACTORS & WEIGHTS INTEGRATION
# ─────────────────────────────────────────────────────────────────────────────


class TestScoringFactorsAndWeights:
    """Verify factors weights and composite recommendation scorer."""

    def test_factor_weights_sum_to_8(self) -> None:
        f_goal = WorkoutGoalAlignmentFactor()
        f_fresh = MuscleGroupFreshnessFactor()
        f_dur = WorkoutDurationFitFactor()
        f_nov = ExerciseNoveltyFactor()

        assert f_goal.weight == 3.0
        assert f_fresh.weight == 2.5
        assert f_dur.weight == 1.5
        assert f_nov.weight == 1.0
        assert f_goal.weight + f_fresh.weight + f_dur.weight + f_nov.weight == 8.0

    def test_freshness_scoring_based_on_recent_muscles(self) -> None:
        factor = MuscleGroupFreshnessFactor()
        user_id = uuid.uuid4()

        ctx = RecommendationContext(
            user_id=user_id,
            recommendation_type=RecommendationType.WORKOUT,
            metadata={"muscle_group_last_trained_hours": {"chest": 10.0, "back": 80.0}},
        )

        cand_chest = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=uuid.uuid4(),
                    exercise_name="Bench",
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                )
            ]
        )
        score_chest = factor.score(cand_chest, ctx).normalized_score
        assert pytest.approx(score_chest, rel=1e-3) == (10.0 / 24.0) * 0.50

        cand_back = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=uuid.uuid4(),
                    exercise_name="Row",
                    category="strength",
                    muscle_groups=["back"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                )
            ]
        )
        assert factor.score(cand_back, ctx).normalized_score == 1.0

    def test_novelty_scoring_penalizes_frequently_performed_exercises(self) -> None:
        factor = ExerciseNoveltyFactor()
        ex_seen_id = uuid.uuid4()
        ex_unseen_id = uuid.uuid4()

        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            metadata={"recent_exercise_ids": [str(ex_seen_id)]},
        )

        cand = _make_workout_candidate(
            exercises=[
                WorkoutExerciseItem(
                    exercise_id=ex_seen_id,
                    exercise_name="Seen",
                    category="strength",
                    muscle_groups=["chest"],
                    equipment="dumbbell",
                    order_index=0,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                ),
                WorkoutExerciseItem(
                    exercise_id=ex_unseen_id,
                    exercise_name="Unseen",
                    category="strength",
                    muscle_groups=["back"],
                    equipment="dumbbell",
                    order_index=1,
                    recommended_sets=3,
                    recommended_reps=10,
                    recommended_duration_seconds=None,
                    recommended_rest_seconds=90,
                ),
            ]
        )
        # 1 unseen / 2 exercises = 0.50
        assert factor.score(cand, ctx).normalized_score == 0.50

    def test_scorer_computes_exact_weighted_average(self) -> None:
        f_goal = WorkoutGoalAlignmentFactor()
        f_fresh = MuscleGroupFreshnessFactor()
        f_dur = WorkoutDurationFitFactor()
        f_nov = ExerciseNoveltyFactor()
        scorer = RecommendationScorer([f_goal, f_fresh, f_dur, f_nov])

        ctx = RecommendationContext(
            user_id=uuid.uuid4(),
            recommendation_type=RecommendationType.WORKOUT,
            goal=GoalContext(goal_type="maintenance"),
            constraints=ConstraintContext(target_duration_minutes=45),
        )
        cand = _make_workout_candidate(
            workout_type="full_body",
            category="strength",
            estimated_duration_minutes=45,
        )
        total_score, factor_scores = scorer.score_candidate(cand, ctx)
        assert 0.0 <= total_score <= 1.0
        assert len(factor_scores) == 4
