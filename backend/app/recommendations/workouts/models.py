"""Phase 7C – Workout Recommendation Models and Helpers.

Defines canonical constants, payload representations, heuristic movement-slot
classification, deterministic duration estimation, and candidate ID construction.
"""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# ── Canonical Constants ──────────────────────────────────────────────────────

CANONICAL_WORKOUT_TYPES: frozenset[str] = frozenset(
    {
        "full_body",
        "upper_body",
        "lower_body",
        "push",
        "pull",
        "cardio",
        "mobility",
    }
)

CANONICAL_WORKOUT_CATEGORIES: frozenset[str] = frozenset(
    {
        "strength",
        "cardio",
        "mobility",
    }
)

CANONICAL_MUSCLE_GROUPS: frozenset[str] = frozenset(
    {
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "quadriceps",
        "hamstrings",
        "glutes",
        "calves",
        "abdominals",
    }
)

MUSCLE_SYNONYMS: dict[str, str] = {
    "quads": "quadriceps",
    "abs": "abdominals",
    "core": "abdominals",
    "obliques": "abdominals",
    "delts": "shoulders",
    "deltoids": "shoulders",
    "lats": "back",
    "upper back": "back",
    "lower back": "back",
    "traps": "back",
    "rhomboids": "back",
}

# Mapping from workout_type to broad category
WORKOUT_TYPE_TO_CATEGORY: dict[str, str] = {
    "full_body": "strength",
    "upper_body": "strength",
    "lower_body": "strength",
    "push": "strength",
    "pull": "strength",
    "cardio": "cardio",
    "mobility": "mobility",
}

# Duration calculation constants
C_REP: float = 4.0
C_TRANSITION: float = 120.0


# ── Payload Models ───────────────────────────────────────────────────────────


class WorkoutExerciseItem(BaseModel):
    """Represents a programmed exercise within a recommended workout candidate."""

    model_config = ConfigDict(frozen=True)

    exercise_id: uuid.UUID
    exercise_name: str
    category: str
    muscle_groups: list[str] = Field(default_factory=list)
    equipment: str | None = None
    order_index: int
    recommended_sets: int
    recommended_reps: int | None = None
    recommended_duration_seconds: int | None = None
    recommended_rest_seconds: int


class WorkoutPayload(BaseModel):
    """Represents a complete, structured workout session candidate."""

    model_config = ConfigDict(frozen=True)

    name: str
    workout_type: str
    category: str
    target_muscle_groups: list[str] = Field(default_factory=list)
    exercises: list[WorkoutExerciseItem] = Field(default_factory=list)
    estimated_duration_minutes: int
    total_sets: int
    primary_equipment_needed: list[str] = Field(default_factory=list)
    variant: str


# ── Helpers ──────────────────────────────────────────────────────────────────


def normalize_muscle_groups(muscle_groups: list[str] | None) -> set[str]:
    """Normalize raw muscle group strings into an order-independent canonical set."""
    if not muscle_groups:
        return set()
    result: set[str] = set()
    for m in muscle_groups:
        if m and m.strip():
            cleaned = m.strip().lower()
            canonical = MUSCLE_SYNONYMS.get(cleaned, cleaned)
            result.add(canonical)
    return result


def get_primary_equipment_needed(exercises: list[WorkoutExerciseItem]) -> list[str]:
    """Extract deduplicated, sorted equipment requirements across all exercises,

    excluding 'none' and empty strings.
    """
    equipment_set = {
        e.equipment.strip().lower()
        for e in exercises
        if e.equipment and e.equipment.strip().lower() not in {"none", ""}
    }
    return sorted(equipment_set)


def classify_exercise(exercise: Any) -> set[str]:
    """Deterministically maps an Exercise to matching functional movement slots.

    Order-independent: operates strictly on the canonical set of muscle groups.
    Precedence rules are evaluated top-to-bottom as specified in the approved architecture.
    Returns a set of matched slot names (empty set if unmapped).
    """
    category = getattr(exercise, "category", "")
    if not category:
        return set()
    c = category.strip().lower()
    name = getattr(exercise, "name", "")
    n = name.strip().lower() if name else ""
    raw_muscles = getattr(exercise, "muscle_groups", None) or []
    m = normalize_muscle_groups(raw_muscles)

    matched_slots: set[str] = set()

    # Rule 1: Cardio
    if c == "cardio":
        matched_slots.add("cardio")
        return matched_slots

    # Rule 2: Mobility (Strictly from flexibility and balance categories)
    if c in {"flexibility", "balance"}:
        lower_muscles = {"quadriceps", "hamstrings", "glutes", "calves"}
        upper_muscles = {"chest", "shoulders", "back", "biceps", "triceps"}

        has_lower = bool(m & lower_muscles)
        has_upper = bool(m & upper_muscles)

        if has_lower and not has_upper:
            matched_slots.add("mobility_lower")
        elif has_upper and not has_lower:
            matched_slots.add("mobility_upper")
        else:
            # Contains abdominals, both upper and lower, or empty
            matched_slots.add("mobility_core")
        return matched_slots

    # Strength rules (only applicable if category == "strength")
    if c != "strength":
        return set()

    # Rule 3: Strength Core
    if m == {"abdominals"}:
        matched_slots.add("core")

    # Rule 4: Strength Arm Isolation
    if m == {"triceps"}:
        matched_slots.add("triceps")
    if m == {"biceps"}:
        matched_slots.add("biceps")

    # Rule 5: Strength Lower Body
    has_quads = "quadriceps" in m
    has_hams = "hamstrings" in m
    has_glutes = "glutes" in m

    if has_quads and has_hams:
        matched_slots.add("squat")
        matched_slots.add("hinge")
    elif has_quads and not has_hams:
        matched_slots.add("squat")
    elif has_hams and not has_quads:
        matched_slots.add("hinge")
    elif has_glutes and not has_quads and not has_hams:
        matched_slots.add("hinge")

    # Rule 6: Strength Upper Push
    has_chest = "chest" in m
    has_shoulders = "shoulders" in m
    has_triceps = "triceps" in m
    has_back = "back" in m

    if has_chest:
        matched_slots.add("push_horizontal")
        matched_slots.add("push")
    elif has_shoulders and not has_chest:
        matched_slots.add("push_vertical")
        matched_slots.add("push")
    elif has_triceps and not has_chest and not has_shoulders and not has_back:
        matched_slots.add("push")

    # Rule 7: Strength Upper Pull
    has_biceps = "biceps" in m
    if has_back:
        if any(substr in n for substr in ("pull", "chin", "down")):
            matched_slots.add("pull_vertical")
            matched_slots.add("pull")
        else:
            matched_slots.add("pull_horizontal")
            matched_slots.add("pull")
    elif has_biceps and not has_back:
        matched_slots.add("pull")

    # Rule 8: Unmapped exercises return empty set
    return matched_slots


def estimate_workout_duration(exercises: list[WorkoutExerciseItem]) -> int:
    """Calculate estimated workout duration in minutes according to the approved formula:

    t_work = reps * 4.0 if rep-based else duration_seconds
    t_exercise = sets * t_work + (sets - 1) * rest
    T_total_seconds = sum(t_exercise) + max(0, N - 1) * 120.0
    D_est = max(1, round(T_total_seconds / 60.0))
    """
    if not exercises:
        return 0

    total_seconds = 0.0
    for e in exercises:
        if e.recommended_reps is not None:
            t_work = float(e.recommended_reps) * C_REP
        elif e.recommended_duration_seconds is not None:
            t_work = float(e.recommended_duration_seconds)
        else:
            t_work = 0.0

        sets = float(e.recommended_sets)
        rest = float(e.recommended_rest_seconds)
        t_exercise = sets * t_work + max(0.0, sets - 1.0) * rest
        total_seconds += t_exercise

    transitions = max(0, len(exercises) - 1)
    total_seconds += float(transitions) * C_TRANSITION

    return max(1, round(total_seconds / 60.0))


def build_candidate_id(
    workout_type: str,
    variant: str,
    exercises: list[WorkoutExerciseItem],
) -> str:
    """Build a deterministic, order-sensitive, collision-free candidate ID.

    Format:
    workout:{workout_type}:{variant}:p0:{id}:{sets}x{reps}r+p1:{id}:{sets}x{dur}d+...
    """
    parts: list[str] = []
    for e in exercises:
        if e.recommended_reps is not None:
            scheme = f"{e.recommended_sets}x{e.recommended_reps}r"
        elif e.recommended_duration_seconds is not None:
            scheme = f"{e.recommended_sets}x{e.recommended_duration_seconds}d"
        else:
            scheme = f"{e.recommended_sets}x0"
        parts.append(f"p{e.order_index}:{e.exercise_id}:{scheme}")

    return f"workout:{workout_type}:{variant}:{'+'.join(parts)}"
