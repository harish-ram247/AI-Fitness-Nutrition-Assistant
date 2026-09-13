import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime

from sqlalchemy import select

from app.models.nutrition import FoodEntry
from app.repositories.base import BaseRepository


class NutritionRepository(BaseRepository):
    async def get_by_id(self, entry_id: uuid.UUID) -> FoodEntry | None:
        stmt = select(FoodEntry).where(
            FoodEntry.id == entry_id,
            FoodEntry.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_and_user(
        self, entry_id: uuid.UUID, user_id: uuid.UUID
    ) -> FoodEntry | None:
        stmt = select(FoodEntry).where(
            FoodEntry.id == entry_id,
            FoodEntry.user_id == user_id,
            FoodEntry.deleted_at.is_(None),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_and_date(
        self, user_id: uuid.UUID, log_date: date
    ) -> Sequence[FoodEntry]:
        """Fetch active food entries for a user on a given date, ordered chronologically.

        Daily summaries and totals must use the snapshot columns on FoodEntry directly.
        """
        stmt = (
            select(FoodEntry)
            .where(
                FoodEntry.user_id == user_id,
                FoodEntry.log_date == log_date,
                FoodEntry.deleted_at.is_(None),
            )
            .order_by(FoodEntry.logged_at.asc(), FoodEntry.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_by_user_and_date_range(
        self, user_id: uuid.UUID, start_date: date, end_date: date
    ) -> Sequence[FoodEntry]:
        stmt = (
            select(FoodEntry)
            .where(
                FoodEntry.user_id == user_id,
                FoodEntry.log_date >= start_date,
                FoodEntry.log_date <= end_date,
                FoodEntry.deleted_at.is_(None),
            )
            .order_by(FoodEntry.log_date.asc(), FoodEntry.logged_at.asc())
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, entry: FoodEntry) -> FoodEntry:
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def soft_delete(self, entry: FoodEntry) -> None:
        entry.deleted_at = datetime.now(UTC)
        await self.session.commit()

    async def delete(self, entry: FoodEntry) -> None:
        await self.session.delete(entry)
        await self.session.commit()

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, entry: FoodEntry) -> None:
        await self.session.refresh(entry)
