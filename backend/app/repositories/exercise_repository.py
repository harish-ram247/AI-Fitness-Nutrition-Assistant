import math
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select

from app.models.exercise import Exercise
from app.repositories.base import BaseRepository


class ExerciseRepository(BaseRepository):
    async def get_by_id(self, exercise_id: uuid.UUID) -> Exercise | None:
        """Retrieve an active exercise by ID without user scoping."""
        stmt = select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_scoped(
        self, exercise_id: uuid.UUID, user_id: uuid.UUID
    ) -> Exercise | None:
        """Retrieve an active exercise enforcing visibility:

        system exercise (created_by_user_id IS NULL) or owned by the user.
        """
        stmt = select(Exercise).where(
            Exercise.id == exercise_id,
            Exercise.deleted_at.is_(None),
            or_(
                Exercise.created_by_user_id.is_(None),
                Exercise.created_by_user_id == user_id,
            ),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_exercises(
        self,
        query: str | None = None,
        category: str | None = None,
        muscle_group: str | None = None,
        page: int = 1,
        size: int = 20,
        user_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[Exercise], int, int]:
        """Search active exercises with visibility filtering (system + owned by user).

        Returns: (items, total_count, total_pages)
        """
        filters: list[Any] = [Exercise.deleted_at.is_(None)]

        if user_id is not None:
            filters.append(
                or_(
                    Exercise.created_by_user_id.is_(None),
                    Exercise.created_by_user_id == user_id,
                )
            )
        else:
            filters.append(Exercise.created_by_user_id.is_(None))

        if query and query.strip():
            filters.append(Exercise.name.ilike(f"%{query.strip()}%"))

        if category and category.strip():
            filters.append(func.lower(Exercise.category) == category.strip().lower())

        if muscle_group and muscle_group.strip():
            filters.append(Exercise.muscle_groups.contains([muscle_group.strip().lower()]))

        # Count query
        count_stmt = select(func.count(Exercise.id)).where(*filters)
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar() or 0

        total_pages = math.ceil(total / size) if total > 0 else 1
        offset = (page - 1) * size

        # Items query
        items_stmt = (
            select(Exercise)
            .where(*filters)
            .order_by(Exercise.name.asc(), Exercise.id.asc())
            .offset(offset)
            .limit(size)
        )
        items_res = await self.session.execute(items_stmt)
        items = items_res.scalars().all()

        return items, total, total_pages

    async def create(self, exercise: Exercise) -> Exercise:
        self.session.add(exercise)
        await self.session.commit()
        await self.session.refresh(exercise)
        return exercise

    async def soft_delete(self, exercise: Exercise) -> None:
        exercise.deleted_at = datetime.now(UTC)
        await self.session.commit()

    async def commit(self) -> None:
        await self.session.commit()
