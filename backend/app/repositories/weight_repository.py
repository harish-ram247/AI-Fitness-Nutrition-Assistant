import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy import select

from app.models.progress import WeightEntry
from app.repositories.base import BaseRepository


class WeightRepository(BaseRepository):
    async def get_by_id(self, entry_id: uuid.UUID) -> WeightEntry | None:
        stmt = select(WeightEntry).where(WeightEntry.id == entry_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_and_date(
        self, user_id: uuid.UUID, log_date: date
    ) -> WeightEntry | None:
        """Fetch a specific date's weight entry for a user."""
        stmt = select(WeightEntry).where(
            WeightEntry.user_id == user_id,
            WeightEntry.log_date == log_date,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_latest_by_user(self, user_id: uuid.UUID) -> WeightEntry | None:
        """Fetch the most recent weight entry for a user, which feeds the profile read-cache."""
        stmt = (
            select(WeightEntry)
            .where(WeightEntry.user_id == user_id)
            .order_by(WeightEntry.log_date.desc(), WeightEntry.created_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_first_by_user(self, user_id: uuid.UUID) -> WeightEntry | None:
        """Fetch the earliest recorded weight entry for a user to determine starting weight."""
        stmt = (
            select(WeightEntry)
            .where(WeightEntry.user_id == user_id)
            .order_by(WeightEntry.log_date.asc(), WeightEntry.created_at.asc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_history_by_user(
        self, user_id: uuid.UUID, start_date: date | None = None, end_date: date | None = None
    ) -> Sequence[WeightEntry]:
        """Fetch weight entry history for a user ordered chronologically."""
        stmt = select(WeightEntry).where(WeightEntry.user_id == user_id)
        if start_date:
            stmt = stmt.where(WeightEntry.log_date >= start_date)
        if end_date:
            stmt = stmt.where(WeightEntry.log_date <= end_date)
        stmt = stmt.order_by(WeightEntry.log_date.asc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, entry: WeightEntry) -> WeightEntry:
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry

    async def delete(self, entry: WeightEntry) -> None:
        await self.session.delete(entry)
        await self.session.commit()
