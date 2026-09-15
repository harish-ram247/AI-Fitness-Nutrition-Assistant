"""Phase 7C – Deterministic Scoring Factors for Workout Recommendations.

Implements all 4 factors specified in the approved architecture:
  1. WorkoutGoalAlignmentFactor (weight: 3.0)
  2. MuscleGroupFreshnessFactor (weight: 2.5)
  3. WorkoutDurationFitFactor (weight: 1.5)
  4. ExerciseNoveltyFactor (weight: 1.0)
Total Weight: 8.0
"""

from __future__ import annotations

import math
from typing import Any

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.scoring import FactorScore
from app.recommendations.workouts.models import WorkoutPayload

WEIGHT_GOAL_ALIGNMENT: float = 3.0
WEIGHT_FRESHNESS: float = 2.5
WEIGHT_DURATION_FIT: float = 1.5
WEIGHT_NOVELTY: float = 1.0


class WorkoutGoalAlignmentFactor:
    """Evaluates how well the candidate aligns with the user's active fitness goal.

    Uses the exact piecewise formulas defined in the approved architecture.
    """

    @property
    def name(self) -> str:
        return "WorkoutGoalAlignmentFactor"

    @property
    def weight(self) -> float:
        return WEIGHT_GOAL_ALIGNMENT

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        payload: WorkoutPayload = candidate.payload
        goal_type = (
            context.goal.goal_type.strip().lower()
            if context.goal and context.goal.goal_type
            else None
        )

        category = payload.category
        workout_type = payload.workout_type
        variant = payload.variant

        if not goal_type:
            # Documented neutral midpoint score for missing or unknown goals
            score = 0.50
            reason = "No active goal specified: neutral baseline alignment."
        elif goal_type in {"muscle_gain", "hypertrophy"}:
            if category != "strength":
                score = 0.20
                reason = f"Category '{category}' has low alignment with muscle gain."
            else:
                s_sets = float(payload.total_sets)
                if 10.0 <= s_sets <= 16.0:
                    v_vol = 1.00
                elif s_sets < 10.0:
                    v_vol = max(0.30, 1.00 - (10.0 - s_sets) / 10.0)
                else:
                    v_vol = max(0.30, 1.00 - (s_sets - 16.0) / 10.0)

                reps_list = [
                    float(e.recommended_reps)
                    for e in payload.exercises
                    if e.recommended_reps is not None
                ]
                r_reps = sum(reps_list) / len(reps_list) if reps_list else 10.0

                if 8.0 <= r_reps <= 12.0:
                    v_rep = 1.00
                elif r_reps < 8.0:
                    v_rep = max(0.40, 1.00 - (8.0 - r_reps) / 8.0)
                else:
                    v_rep = max(0.40, 1.00 - (r_reps - 12.0) / 12.0)

                score = 0.50 * v_vol + 0.50 * v_rep
                reason = (
                    f"Muscle gain alignment: {payload.total_sets} sets "
                    f"(vol: {v_vol:.2f}), avg reps {r_reps:.1f} (rep: {v_rep:.2f})."
                )

        elif goal_type == "strength":
            if category != "strength":
                score = 0.15
                reason = f"Category '{category}' has low alignment with strength."
            else:
                # v_variant is a deterministic product-defined heuristic alignment score
                v_variant = 0.95 if variant == "density" else 0.80
                v_split = 1.00  # all strength splits are compound-focused
                score = 0.60 * v_variant + 0.40 * v_split
                reason = (
                    f"Strength alignment: variant '{variant}' ({v_variant:.2f}), "
                    f"split '{workout_type}' ({v_split:.2f})."
                )

        elif goal_type in {"weight_loss", "fat_loss"}:
            if workout_type == "cardio":
                score = 1.00
                reason = "Cardio workout provides direct metabolic expenditure for weight loss."
            elif category == "strength":
                v_dense = 0.90 if variant == "density" else 0.70
                v_split = 1.00 if workout_type == "full_body" else 0.80
                score = 0.60 * v_dense + 0.40 * v_split
                reason = (
                    f"Weight loss alignment: rest density ({v_dense:.2f}), "
                    f"split '{workout_type}' ({v_split:.2f})."
                )
            elif workout_type == "mobility":
                score = 0.40
                reason = "Mobility workout provides lower metabolic output for weight loss."
            else:
                score = 0.50
                reason = "Neutral weight loss alignment."

        elif goal_type == "endurance":
            if workout_type == "cardio":
                score = 1.00 if variant == "density" else 0.90
                reason = f"Cardio endurance alignment with variant '{variant}'."
            elif category == "strength":
                score = 0.50 if variant == "density" else 0.35
                reason = f"Strength endurance alignment with variant '{variant}'."
            elif workout_type == "mobility":
                score = 0.30
                reason = "Mobility has limited alignment with endurance."
            else:
                score = 0.50
                reason = "Neutral endurance alignment."

        elif goal_type == "maintenance":
            if workout_type == "full_body":
                score = 1.00
                reason = "Full body routine offers highest systemic balance for maintenance."
            elif category == "strength":
                score = 0.90
                reason = f"Split '{workout_type}' provides solid maintenance stimulus."
            elif workout_type == "cardio":
                score = 0.85
                reason = "Cardio supports cardiovascular maintenance."
            elif workout_type == "mobility":
                score = 0.75
                reason = "Mobility supports functional maintenance."
            else:
                score = 0.50
                reason = "Neutral maintenance alignment."

        else:
            score = 0.50
            reason = f"Unknown goal '{goal_type}': assigned neutral baseline alignment."

        bounded_score = max(0.0, min(1.0, round(score, 4)))
        weighted = round(bounded_score * self.weight, 4)

        return FactorScore(
            factor_name=self.name,
            raw_score=bounded_score,
            normalized_score=bounded_score,
            weight=self.weight,
            weighted_contribution=weighted,
            reason=reason,
        )


class MuscleGroupFreshnessFactor:
    """Evaluates personalization variety across targeted muscle groups relative

    to 7-day training history.
    """

    @property
    def name(self) -> str:
        return "MuscleGroupFreshnessFactor"

    @property
    def weight(self) -> float:
        return WEIGHT_FRESHNESS

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        payload: WorkoutPayload = candidate.payload
        target_muscles = payload.target_muscle_groups

        if not target_muscles:
            return FactorScore(
                factor_name=self.name,
                raw_score=1.00,
                normalized_score=1.00,
                weight=self.weight,
                weighted_contribution=self.weight,
                reason="No target muscle groups specified: maximum freshness score.",
            )

        muscle_hours = context.metadata.get("muscle_group_last_trained_hours", {})

        scores: list[float] = []
        for m in target_muscles:
            h = muscle_hours.get(m)
            if h is None or h >= 48.0 or math.isinf(h):
                f = 1.00
            elif 24.0 <= h < 48.0:
                f = 0.50 + 0.50 * ((h - 24.0) / 24.0)
            elif 0.0 <= h < 24.0:
                f = max(0.10, (h / 24.0) * 0.50)
            else:
                f = 0.10
            scores.append(f)

        avg_freshness = sum(scores) / len(scores) if scores else 1.00
        bounded_score = max(0.0, min(1.0, round(avg_freshness, 4)))
        weighted = round(bounded_score * self.weight, 4)

        fresh_count = sum(1 for s in scores if s >= 0.99)
        reason = (
            f"Muscle group freshness: {fresh_count}/{len(scores)} "
            f"targeted muscles rested >=48h (average variety score: {bounded_score:.2f})."
        )

        return FactorScore(
            factor_name=self.name,
            raw_score=bounded_score,
            normalized_score=bounded_score,
            weight=self.weight,
            weighted_contribution=weighted,
            reason=reason,
        )


class WorkoutDurationFitFactor:
    """Evaluates proximity of estimated workout duration to the target duration:

    S = exp(-|D_est - D_target| / (0.40 * D_target))
    """

    @property
    def name(self) -> str:
        return "WorkoutDurationFitFactor"

    @property
    def weight(self) -> float:
        return WEIGHT_DURATION_FIT

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        payload: WorkoutPayload = candidate.payload
        raw_target = context.constraints.target_duration_minutes
        d_target = float(max(15, min(120, raw_target))) if raw_target is not None else 45.0
        d_est = float(payload.estimated_duration_minutes)

        diff = abs(d_est - d_target)
        score = math.exp(-diff / (0.40 * d_target))
        bounded_score = max(0.0, min(1.0, round(score, 4)))
        weighted = round(bounded_score * self.weight, 4)

        reason = (
            f"Estimated duration {int(d_est)} min aligns with requested {int(d_target)} min "
            f"(proximity score: {bounded_score:.2f})."
        )

        return FactorScore(
            factor_name=self.name,
            raw_score=bounded_score,
            normalized_score=bounded_score,
            weight=self.weight,
            weighted_contribution=weighted,
            reason=reason,
        )


class ExerciseNoveltyFactor:
    """Evaluates novelty relative to exercises performed in the past 7 days:

    S = count(e not in recent_ids) / total_exercises
    """

    @property
    def name(self) -> str:
        return "ExerciseNoveltyFactor"

    @property
    def weight(self) -> float:
        return WEIGHT_NOVELTY

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        payload: WorkoutPayload = candidate.payload
        exercises = payload.exercises

        if not exercises:
            return FactorScore(
                factor_name=self.name,
                raw_score=1.00,
                normalized_score=1.00,
                weight=self.weight,
                weighted_contribution=self.weight,
                reason="No exercises in candidate: default maximum novelty.",
            )

        raw_recent = context.metadata.get("recent_exercise_ids", [])
        recent_ids = {str(eid) for eid in raw_recent}

        unseen_count = sum(1 for e in exercises if str(e.exercise_id) not in recent_ids)
        score = float(unseen_count) / float(len(exercises))
        bounded_score = max(0.0, min(1.0, round(score, 4)))
        weighted = round(bounded_score * self.weight, 4)

        reason = (
            f"Exercise novelty: {unseen_count}/{len(exercises)} exercises not performed "
            f"in the last 7 days."
        )

        return FactorScore(
            factor_name=self.name,
            raw_score=bounded_score,
            normalized_score=bounded_score,
            weight=self.weight,
            weighted_contribution=weighted,
            reason=reason,
        )
