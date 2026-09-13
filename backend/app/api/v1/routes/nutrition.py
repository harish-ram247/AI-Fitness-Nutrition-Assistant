import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.ai import get_ai_service
from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.food_repository import FoodRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.schemas.nutrition import (
    DailyNutritionSummaryResponse,
    FoodEntryCreate,
    FoodEntryRead,
    FoodEntryUpdate,
    NaturalLanguageConfirmRequest,
    NaturalLanguageLogPreview,
    NaturalLanguageLogRequest,
    NutritionHistoryResponse,
)
from app.services.ai_service import AIService
from app.services.nutrition_service import NutritionService

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def get_nutrition_service(db: AsyncSession = Depends(get_db)) -> NutritionService:
    return NutritionService(NutritionRepository(db), FoodRepository(db))


@router.get(
    "/daily",
    response_model=DailyNutritionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get daily nutrition summary and meal breakdown",
)
async def get_daily_summary(
    log_date: date = Query(..., alias="date", description="Summary date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    nutrition_service: NutritionService = Depends(get_nutrition_service),
) -> Any:
    return await nutrition_service.get_daily_summary(
        user_id=current_user.id, log_date=log_date
    )


@router.post(
    "/entries",
    response_model=FoodEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log a food entry with deterministic snapshot calculation",
)
async def log_food_entry(
    data: FoodEntryCreate,
    current_user: User = Depends(get_current_user),
    nutrition_service: NutritionService = Depends(get_nutrition_service),
) -> Any:
    return await nutrition_service.log_food_entry(
        user_id=current_user.id, data=data
    )


@router.patch(
    "/entries/{entry_id}",
    response_model=FoodEntryRead,
    status_code=status.HTTP_200_OK,
    summary="Update a logged food entry",
)
async def update_food_entry(
    entry_id: uuid.UUID,
    data: FoodEntryUpdate,
    current_user: User = Depends(get_current_user),
    nutrition_service: NutritionService = Depends(get_nutrition_service),
) -> Any:
    return await nutrition_service.update_food_entry(
        user_id=current_user.id, entry_id=entry_id, data=data
    )


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a logged food entry",
)
async def delete_food_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    nutrition_service: NutritionService = Depends(get_nutrition_service),
) -> None:
    await nutrition_service.delete_food_entry(
        user_id=current_user.id, entry_id=entry_id
    )


@router.get(
    "/history",
    response_model=NutritionHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get aggregated nutrition history over a date range",
)
async def get_history(
    from_date: date = Query(..., alias="from", description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., alias="to", description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    nutrition_service: NutritionService = Depends(get_nutrition_service),
) -> Any:
    return await nutrition_service.get_history(
        user_id=current_user.id, start_date=from_date, end_date=to_date
    )


@router.post(
    "/log-natural-language",
    response_model=NaturalLanguageLogPreview,
    status_code=status.HTTP_200_OK,
    summary="Extract food items from natural language text and return preview",
)
async def log_natural_language(
    request: NaturalLanguageLogRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> Any:
    return await ai_service.log_natural_language(
        db=db,
        user_id=current_user.id,
        request=request,
    )


@router.post(
    "/log-natural-language/confirm",
    response_model=list[FoodEntryRead],
    status_code=status.HTTP_201_CREATED,
    summary="Confirm and persist extracted food items with server-side calculation",
)
async def confirm_natural_language(
    request: NaturalLanguageConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> Any:
    return await ai_service.confirm_natural_language(
        db=db,
        user_id=current_user.id,
        request=request,
    )
