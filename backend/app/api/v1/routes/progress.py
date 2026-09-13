import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.weight_repository import WeightRepository
from app.schemas.progress import (
    WeightEntryCreate,
    WeightEntryRead,
    WeightEntryUpdate,
    WeightHistoryResponse,
)
from app.services.progress_service import ProgressService

router = APIRouter(prefix="/progress", tags=["progress"])


def get_progress_service(db: AsyncSession = Depends(get_db)) -> ProgressService:
    return ProgressService(WeightRepository(db), UserRepository(db))


@router.get(
    "/weight",
    response_model=WeightHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get weight history and trend",
)
async def get_weight_history(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> Any:
    return await progress_service.get_weight_history(
        current_user.id, start_date=from_date, end_date=to_date
    )


@router.post(
    "/weight",
    response_model=WeightEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log body weight and update current weight cache",
)
async def log_weight(
    data: WeightEntryCreate,
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> Any:
    return await progress_service.log_weight(current_user.id, data)


@router.patch(
    "/weight/{entry_id}",
    response_model=WeightEntryRead,
    status_code=status.HTTP_200_OK,
    summary="Update an existing weight entry and recalculate current weight cache",
)
async def update_weight_entry(
    entry_id: uuid.UUID,
    data: WeightEntryUpdate,
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> Any:
    return await progress_service.update_weight_entry(
        current_user.id, entry_id, data
    )


@router.delete(
    "/weight/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a weight entry and update current weight cache",
)
async def delete_weight_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    progress_service: ProgressService = Depends(get_progress_service),
) -> None:
    await progress_service.delete_weight_entry(current_user.id, entry_id)
