"""Phase 7C – Workout Recommendations Package."""

from __future__ import annotations

from app.recommendations.workouts.context_builder import WorkoutRecommendationContextBuilder
from app.recommendations.workouts.filters import (
    WorkoutDurationFilter,
    WorkoutEquipmentFilter,
    WorkoutStructureFilter,
    WorkoutVisibilityFilter,
)
from app.recommendations.workouts.generator import WorkoutCandidateGenerator
from app.recommendations.workouts.models import (
    CANONICAL_MUSCLE_GROUPS,
    CANONICAL_WORKOUT_CATEGORIES,
    CANONICAL_WORKOUT_TYPES,
    MUSCLE_SYNONYMS,
    WorkoutExerciseItem,
    WorkoutPayload,
    build_candidate_id,
    classify_exercise,
    estimate_workout_duration,
    get_primary_equipment_needed,
    normalize_muscle_groups,
)
from app.recommendations.workouts.scoring import (
    ExerciseNoveltyFactor,
    MuscleGroupFreshnessFactor,
    WorkoutDurationFitFactor,
    WorkoutGoalAlignmentFactor,
)
from app.recommendations.workouts.service import WorkoutRecommendationService

__all__ = [
    "CANONICAL_MUSCLE_GROUPS",
    "CANONICAL_WORKOUT_CATEGORIES",
    "CANONICAL_WORKOUT_TYPES",
    "ExerciseNoveltyFactor",
    "MUSCLE_SYNONYMS",
    "MuscleGroupFreshnessFactor",
    "WorkoutCandidateGenerator",
    "WorkoutDurationFilter",
    "WorkoutDurationFitFactor",
    "WorkoutEquipmentFilter",
    "WorkoutExerciseItem",
    "WorkoutGoalAlignmentFactor",
    "WorkoutPayload",
    "WorkoutRecommendationContextBuilder",
    "WorkoutRecommendationService",
    "WorkoutStructureFilter",
    "WorkoutVisibilityFilter",
    "build_candidate_id",
    "classify_exercise",
    "estimate_workout_duration",
    "get_primary_equipment_needed",
    "normalize_muscle_groups",
]
