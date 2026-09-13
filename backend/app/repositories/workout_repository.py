import math
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.workout import WorkoutExercise, WorkoutSession, WorkoutSet
from app.repositories.base import BaseRepository


class WorkoutRepository(BaseRepository):
    async def get_session_by_id_and_user(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkoutSession | None:
        """Retrieve an active workout session by ID and user, with eager-loaded

        exercises and sets.
        """
        stmt = (
            select(WorkoutSession)
            .where(
                WorkoutSession.id == session_id,
                WorkoutSession.user_id == user_id,
                WorkoutSession.deleted_at.is_(None),
            )
            .options(
                selectinload(WorkoutSession.exercises).selectinload(WorkoutExercise.exercise),
                selectinload(WorkoutSession.exercises).selectinload(WorkoutExercise.sets),
            )
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        session = result.scalar_one_or_none()
        if session:
            self._sort_session_nested(session)
        return session

    async def get_sessions_by_user(
        self,
        user_id: uuid.UUID,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[Sequence[WorkoutSession], int, int]:
        """Retrieve paginated active workout sessions for a user with optional date filtering.

        Returns: (items, total_count, total_pages)
        """
        filters: list[Any] = [
            WorkoutSession.user_id == user_id,
            WorkoutSession.deleted_at.is_(None),
        ]

        if from_date is not None:
            filters.append(WorkoutSession.started_at >= from_date)

        if to_date is not None:
            filters.append(WorkoutSession.started_at <= to_date)

        # Count query
        count_stmt = select(func.count(WorkoutSession.id)).where(*filters)
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar() or 0

        total_pages = math.ceil(total / size) if total > 0 else 1
        offset = (page - 1) * size

        # Items query
        items_stmt = (
            select(WorkoutSession)
            .where(*filters)
            .order_by(WorkoutSession.started_at.desc(), WorkoutSession.id.desc())
            .offset(offset)
            .limit(size)
            .options(
                selectinload(WorkoutSession.exercises).selectinload(WorkoutExercise.exercise),
                selectinload(WorkoutSession.exercises).selectinload(WorkoutExercise.sets),
            )
            .execution_options(populate_existing=True)
        )
        items_res = await self.session.execute(items_stmt)
        items = items_res.scalars().all()

        for session in items:
            self._sort_session_nested(session)

        return items, total, total_pages

    async def create_session(self, session: WorkoutSession) -> WorkoutSession:
        """Persist a workout session and return the re-queried fully loaded instance."""
        self.session.add(session)
        await self.session.commit()
        loaded = await self.get_session_by_id_and_user(session.id, session.user_id)
        assert loaded is not None
        return loaded

    async def soft_delete_session(self, session: WorkoutSession) -> None:
        """Mark a workout session as soft-deleted."""
        session.deleted_at = datetime.now(UTC)
        await self.session.commit()

    async def get_workout_exercise(
        self, workout_exercise_id: uuid.UUID, session_id: uuid.UUID
    ) -> WorkoutExercise | None:
        """Retrieve a WorkoutExercise guaranteeing it belongs to session_id."""
        stmt = (
            select(WorkoutExercise)
            .where(
                WorkoutExercise.id == workout_exercise_id,
                WorkoutExercise.workout_session_id == session_id,
            )
            .options(
                selectinload(WorkoutExercise.exercise),
                selectinload(WorkoutExercise.sets),
            )
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        we = result.scalar_one_or_none()
        if we and we.sets:
            we.sets.sort(key=lambda s: (s.set_number, s.id))
        return we

    async def add_workout_exercise(self, workout_exercise: WorkoutExercise) -> WorkoutExercise:
        self.session.add(workout_exercise)
        await self.session.commit()
        stmt = (
            select(WorkoutExercise)
            .where(WorkoutExercise.id == workout_exercise.id)
            .options(
                selectinload(WorkoutExercise.exercise),
                selectinload(WorkoutExercise.sets),
            )
            .execution_options(populate_existing=True)
        )
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def delete_workout_exercise(self, workout_exercise: WorkoutExercise) -> None:
        await self.session.delete(workout_exercise)
        await self.session.commit()

    async def get_workout_set(
        self, set_id: uuid.UUID, workout_exercise_id: uuid.UUID
    ) -> WorkoutSet | None:
        """Retrieve a WorkoutSet guaranteeing it belongs to workout_exercise_id."""
        stmt = (
            select(WorkoutSet)
            .where(
                WorkoutSet.id == set_id,
                WorkoutSet.workout_exercise_id == workout_exercise_id,
            )
            .execution_options(populate_existing=True)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def check_duplicate_set_number(
        self,
        workout_exercise_id: uuid.UUID,
        set_number: int,
        exclude_set_id: uuid.UUID | None = None,
    ) -> bool:
        """Return True if a set with set_number exists for this workout_exercise."""
        filters = [
            WorkoutSet.workout_exercise_id == workout_exercise_id,
            WorkoutSet.set_number == set_number,
        ]
        if exclude_set_id is not None:
            filters.append(WorkoutSet.id != exclude_set_id)

        stmt = select(func.count(WorkoutSet.id)).where(*filters)
        res = await self.session.execute(stmt)
        count = res.scalar() or 0
        return count > 0

    async def add_workout_set(self, workout_set: WorkoutSet) -> WorkoutSet:
        self.session.add(workout_set)
        await self.session.commit()
        await self.session.refresh(workout_set)
        return workout_set

    async def delete_workout_set(self, workout_set: WorkoutSet) -> None:
        await self.session.delete(workout_set)
        await self.session.commit()

    async def commit(self) -> None:
        await self.session.commit()

    def _sort_session_nested(self, session: WorkoutSession) -> None:
        """Ensure exercises and sets have deterministic ordering:

        exercises: order_index ASC, id ASC
        sets: set_number ASC, id ASC
        """
        if session.exercises:
            session.exercises.sort(key=lambda e: (e.order_index, e.id))
            for we in session.exercises:
                if we.sets:
                    we.sets.sort(key=lambda s: (s.set_number, s.id))
