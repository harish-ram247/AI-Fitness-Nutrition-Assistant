import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.food_repository import FoodRepository
from app.schemas.food import (
    CustomFoodCreate,
    CustomFoodUpdate,
    FoodItemRead,
    FoodSearchResponse,
)
from app.services.food_service import FoodService

router = APIRouter(prefix="/foods", tags=["foods"])


def get_food_service(db: AsyncSession = Depends(get_db)) -> FoodService:
    return FoodService(FoodRepository(db))


@router.get(
    "",
    response_model=FoodSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search food items catalog and custom foods",
)
async def search_foods(
    q: str | None = Query(None, description="Search query string"),
    category: str | None = Query(None, description="Food category filter"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    food_service: FoodService = Depends(get_food_service),
) -> Any:
    return await food_service.search_foods(
        query=q,
        category=category,
        page=page,
        size=size,
        user_id=current_user.id,
    )


@router.get(
    "/{food_id}",
    response_model=FoodItemRead,
    status_code=status.HTTP_200_OK,
    summary="Get single food item details and servings",
)
async def get_food(
    food_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    food_service: FoodService = Depends(get_food_service),
) -> Any:
    return await food_service.get_food(food_id=food_id, user_id=current_user.id)


@router.post(
    "",
    response_model=FoodItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom food item",
)
async def create_custom_food(
    data: CustomFoodCreate,
    current_user: User = Depends(get_current_user),
    food_service: FoodService = Depends(get_food_service),
) -> Any:
    return await food_service.create_custom_food(user_id=current_user.id, data=data)


@router.patch(
    "/{food_id}",
    response_model=FoodItemRead,
    status_code=status.HTTP_200_OK,
    summary="Update a custom food item (owner only)",
)
async def update_custom_food(
    food_id: uuid.UUID,
    data: CustomFoodUpdate,
    current_user: User = Depends(get_current_user),
    food_service: FoodService = Depends(get_food_service),
) -> Any:
    return await food_service.update_custom_food(
        user_id=current_user.id, food_id=food_id, data=data
    )


@router.delete(
    "/{food_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a custom food item (owner only)",
)
async def delete_custom_food(
    food_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    food_service: FoodService = Depends(get_food_service),
) -> None:
    await food_service.delete_custom_food(user_id=current_user.id, food_id=food_id)
