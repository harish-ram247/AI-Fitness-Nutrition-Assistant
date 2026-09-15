"""Phase 7C – Workout Recommendation Context Builder.

Compiles a pure, minimal, intent-specific RecommendationContext:
  - Profile (age, gender, height, weight, activity level)
  - Active goal (or neutral default)
  - Preferences (unit system, preferred workout days)
  - Workout summary (7-day session count, last date, trained muscle groups)
  - Constraints (available equipment, target duration, custom constraints)
  - Metadata (hours since last trained per muscle, recent exercise IDs)

Infrastructure objects (e.g. AsyncSession) are NEVER embedded in context.
"""

from __future__ import annotations

import datetime
from datetime import UTC, timedelta
from typing import Any

from app.models.user import User
from app.recommendations.context import (
    ConstraintContext,
    GoalContext,
    PreferencesContext,
    RecommendationContext,
    UserProfileContext,
    WorkoutSummaryContext,
)
from app.recommendations.types import RecommendationType
from app.recommendations.workouts.models import normalize_muscle_groups
from app.repositories.goal_repository import GoalRepository
from app.repositories.workout_repository import WorkoutRepository


class WorkoutRecommendationContextBuilder:
    """Compiles pure RecommendationContext for workout recommendations."""

    def __init__(
        self,
        workout_repo: WorkoutRepository,
        goal_repo: GoalRepository,
    ) -> None:
        self.workout_repo = workout_repo
        self.goal_repo = goal_repo

    async def build(
        self,
        user: User,
        target_duration_minutes: int | None = None,
        workout_type: str | None = None,
        equipment: list[str] | None = None,
    ) -> RecommendationContext:
        now_utc = datetime.datetime.now(UTC)
        from_date = now_utc - timedelta(days=7)

        # 1. Query recent workout sessions in 7-day window
        sessions, _, _ = await self.workout_repo.get_sessions_by_user(
            user_id=user.id,
            from_date=from_date,
            to_date=now_utc,
            page=1,
            size=100,
        )

        recent_session_count_7d = len(sessions)
        last_workout_date: datetime.date | None = None
        if sessions and sessions[0].started_at:
            last_workout_date = sessions[0].started_at.date()

        # Track recency per muscle group and recent exercise IDs
        muscle_max_timestamp: dict[str, datetime.datetime] = {}
        recent_exercise_ids_set: set[str] = set()

        for session in sessions:
            sess_time = session.started_at or session.created_at
            if not sess_time:
                continue

            for we in session.exercises:
                if we.exercise_id:
                    recent_exercise_ids_set.add(str(we.exercise_id))

                if we.exercise and we.exercise.muscle_groups:
                    normalized = normalize_muscle_groups(we.exercise.muscle_groups)
                    for m in normalized:
                        existing = muscle_max_timestamp.get(m)
                        if existing is None or sess_time > existing:
                            muscle_max_timestamp[m] = sess_time

        # Calculate elapsed hours per muscle group
        muscle_last_trained_hours: dict[str, float] = {}
        for m, ts in muscle_max_timestamp.items():
            elapsed_sec = (now_utc - ts).total_seconds()
            muscle_last_trained_hours[m] = max(0.0, elapsed_sec / 3600.0)

        recent_muscle_groups = sorted(muscle_max_timestamp.keys())
        recent_exercise_ids = sorted(recent_exercise_ids_set)

        # 2. Build UserProfileContext
        profile_ctx: UserProfileContext | None = None
        if user.profile:
            age: int | None = None
            if user.profile.date_of_birth:
                today = now_utc.date()
                dob = user.profile.date_of_birth
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

            profile_ctx = UserProfileContext(
                age=age,
                gender=user.profile.sex,
                height_cm=float(user.profile.height_cm) if user.profile.height_cm else None,
                weight_kg=(
                    float(user.profile.current_weight_kg)
                    if user.profile.current_weight_kg
                    else None
                ),
                activity_level=user.profile.activity_level or "sedentary",
            )

        # 3. Build GoalContext
        goals = await self.goal_repo.list_by_user(user.id, status="active")
        goal_ctx: GoalContext | None = None
        if goals:
            active_goal = goals[0]
            goal_ctx = GoalContext(
                goal_type=active_goal.goal_type,
                target_value=(
                    float(active_goal.target_value) if active_goal.target_value else None
                ),
                target_unit=active_goal.target_unit,
                description=active_goal.description,
            )

        # 4. Build PreferencesContext
        prefs_ctx: PreferencesContext | None = None
        if user.preferences:
            prefs_ctx = PreferencesContext(
                preferred_workout_days=[],
                dietary_restrictions=list(user.preferences.dietary_restrictions or []),
            )

        # 5. Build WorkoutSummaryContext
        workout_summary = WorkoutSummaryContext(
            recent_session_count_7d=recent_session_count_7d,
            last_workout_date=last_workout_date,
            recent_muscle_groups=recent_muscle_groups,
        )

        # 6. Build ConstraintContext
        effective_duration = (
            max(15, min(120, target_duration_minutes))
            if target_duration_minutes is not None
            else 45
        )
        custom_constraints: dict[str, Any] = {}
        if workout_type:
            custom_constraints["workout_type"] = workout_type

        clean_equipment: list[str] = [
            eq.strip().lower() for eq in (equipment or []) if eq and eq.strip()
        ]

        constraints = ConstraintContext(
            available_equipment=clean_equipment,
            target_duration_minutes=effective_duration,
            custom_constraints=custom_constraints,
        )

        # 7. Metadata (pure domain data, no DB session)
        metadata: dict[str, Any] = {
            "muscle_group_last_trained_hours": muscle_last_trained_hours,
            "recent_exercise_ids": recent_exercise_ids,
            "recent_sessions_found_7d": recent_session_count_7d,
            "last_workout_date": str(last_workout_date) if last_workout_date else None,
        }

        return RecommendationContext(
            user_id=user.id,
            recommendation_type=RecommendationType.WORKOUT,
            profile=profile_ctx,
            goal=goal_ctx,
            preferences=prefs_ctx,
            workout_summary=workout_summary,
            constraints=constraints,
            metadata=metadata,
        )
