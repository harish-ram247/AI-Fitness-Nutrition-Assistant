import uuid
from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.progress import WeightEntry
from app.repositories.user_repository import UserRepository
from app.repositories.weight_repository import WeightRepository
from app.schemas.progress import (
    WeightEntryCreate,
    WeightEntryUpdate,
    WeightHistoryItem,
    WeightHistoryResponse,
)


class ProgressService:
    def __init__(
        self, weight_repo: WeightRepository, user_repo: UserRepository
    ) -> None:
        self.weight_repo = weight_repo
        self.user_repo = user_repo

    async def log_weight(
        self, user_id: uuid.UUID, data: WeightEntryCreate
    ) -> WeightEntry:
        log_date = data.logged_at.date()

        # Check same-day uniqueness constraint
        existing = await self.weight_repo.get_by_user_and_date(user_id, log_date)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A weight entry for this date already exists.",
            )

        entry = WeightEntry(
            user_id=user_id,
            weight_kg=data.weight_kg,
            logged_at=data.logged_at,
            log_date=log_date,
            notes=data.notes,
        )
        self.weight_repo.session.add(entry)
        await self.weight_repo.session.flush()

        # Synchronize profile current_weight_kg from authoritative latest entry
        latest = await self.weight_repo.get_latest_by_user(user_id)
        profile = await self.user_repo.get_profile(user_id)
        if profile and latest:
            profile.current_weight_kg = latest.weight_kg

        await self.weight_repo.session.commit()
        await self.weight_repo.session.refresh(entry)
        return entry

    async def get_weight_history(
        self,
        user_id: uuid.UUID,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> WeightHistoryResponse:
        entries = await self.weight_repo.get_history_by_user(
            user_id, start_date=start_date, end_date=end_date
        )
        first_entry = await self.weight_repo.get_first_by_user(user_id)
        latest_entry = await self.weight_repo.get_latest_by_user(user_id)

        items = [
            WeightHistoryItem(
                id=e.id,
                date=e.log_date,
                weight_kg=e.weight_kg,
                notes=e.notes,
            )
            for e in entries
        ]

        start_weight = first_entry.weight_kg if first_entry else None
        current_weight = latest_entry.weight_kg if latest_entry else None

        trend: str | None = None
        if len(entries) >= 2 and start_weight is not None and current_weight is not None:
            if current_weight < start_weight:
                trend = "decreasing"
            elif current_weight > start_weight:
                trend = "increasing"
            else:
                trend = "stable"

        return WeightHistoryResponse(
            entries=items,
            current_weight_kg=current_weight,
            start_weight_kg=start_weight,
            trend=trend,
        )

    async def update_weight_entry(
        self, user_id: uuid.UUID, entry_id: uuid.UUID, data: WeightEntryUpdate
    ) -> WeightEntry:
        entry = await self.weight_repo.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weight entry not found",
            )

        if entry.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this weight entry",
            )

        if data.logged_at is not None:
            new_date = data.logged_at.date()
            if new_date != entry.log_date:
                existing = await self.weight_repo.get_by_user_and_date(user_id, new_date)
                if existing and existing.id != entry.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="A weight entry for this date already exists.",
                    )
                entry.log_date = new_date
            entry.logged_at = data.logged_at

        if data.weight_kg is not None:
            entry.weight_kg = Decimal(str(data.weight_kg))

        if data.notes is not None:
            entry.notes = data.notes

        await self.weight_repo.session.flush()

        # Recalculate latest weight and update profile cache transactionally
        latest = await self.weight_repo.get_latest_by_user(user_id)
        profile = await self.user_repo.get_profile(user_id)
        if profile and latest:
            profile.current_weight_kg = latest.weight_kg

        await self.weight_repo.session.commit()
        await self.weight_repo.session.refresh(entry)
        return entry

    async def delete_weight_entry(
        self, user_id: uuid.UUID, entry_id: uuid.UUID
    ) -> None:
        entry = await self.weight_repo.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Weight entry not found",
            )

        if entry.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this weight entry",
            )

        await self.weight_repo.session.delete(entry)
        await self.weight_repo.session.flush()

        # Recalculate latest weight from remaining entries
        latest = await self.weight_repo.get_latest_by_user(user_id)
        profile = await self.user_repo.get_profile(user_id)
        if profile:
            profile.current_weight_kg = latest.weight_kg if latest else None

        await self.weight_repo.session.commit()
