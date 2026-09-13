import uuid
from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.food import FoodItem, FoodItemServing
from app.repositories.food_repository import FoodRepository
from app.schemas.food import (
    CustomFoodCreate,
    CustomFoodUpdate,
    FoodItemRead,
    FoodSearchResponse,
)


class FoodService:
    def __init__(self, food_repo: FoodRepository) -> None:
        self.food_repo = food_repo

    async def search_foods(
        self,
        query: str | None = None,
        category: str | None = None,
        page: int = 1,
        size: int = 20,
        user_id: uuid.UUID | None = None,
    ) -> FoodSearchResponse:
        if page < 1:
            page = 1
        if size < 1 or size > 100:
            size = 20

        items, total, pages = await self.food_repo.search_foods(
            query=query,
            category=category,
            page=page,
            size=size,
            user_id=user_id,
        )
        item_reads = [FoodItemRead.model_validate(item) for item in items]
        return FoodSearchResponse(
            items=item_reads,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_food(
        self, food_id: uuid.UUID, user_id: uuid.UUID
    ) -> FoodItem:
        food = await self.food_repo.get_by_id_scoped(food_id, user_id)
        if not food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food item not found",
            )
        return food

    async def create_custom_food(
        self, user_id: uuid.UUID, data: CustomFoodCreate
    ) -> FoodItem:
        food_id = uuid.uuid4()
        food_item = FoodItem(
            id=food_id,
            name=data.name.strip(),
            brand=data.brand.strip() if data.brand else None,
            category=data.category.strip() if data.category else None,
            calories_per_100g=data.calories_per_100g,
            protein_per_100g=data.protein_per_100g,
            carbs_per_100g=data.carbs_per_100g,
            fat_per_100g=data.fat_per_100g,
            fiber_per_100g=data.fiber_per_100g,
            sugar_per_100g=data.sugar_per_100g,
            sodium_per_100g=data.sodium_per_100g,
            source="user",
            usda_fdc_id=None,
            created_by_user_id=user_id,
            is_verified=False,
        )

        if data.servings:
            for s in data.servings:
                food_item.servings.append(
                    FoodItemServing(
                        id=uuid.uuid4(),
                        food_item_id=food_id,
                        description=s.description.strip(),
                        grams=s.grams,
                        is_default=s.is_default,
                    )
                )
        else:
            food_item.servings.append(
                FoodItemServing(
                    id=uuid.uuid4(),
                    food_item_id=food_id,
                    description="100g",
                    grams=Decimal("100.00"),
                    is_default=True,
                )
            )

        return await self.food_repo.create(food_item)

    async def update_custom_food(
        self, user_id: uuid.UUID, food_id: uuid.UUID, data: CustomFoodUpdate
    ) -> FoodItem:
        food = await self.food_repo.get_by_id(food_id)
        if not food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food item not found",
            )

        if food.created_by_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify catalog food items",
            )

        if food.created_by_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this food item",
            )

        if data.name is not None:
            food.name = data.name.strip()
        if data.brand is not None:
            food.brand = data.brand.strip() if data.brand else None
        if data.category is not None:
            food.category = data.category.strip() if data.category else None
        if data.calories_per_100g is not None:
            food.calories_per_100g = data.calories_per_100g
        if data.protein_per_100g is not None:
            food.protein_per_100g = data.protein_per_100g
        if data.carbs_per_100g is not None:
            food.carbs_per_100g = data.carbs_per_100g
        if data.fat_per_100g is not None:
            food.fat_per_100g = data.fat_per_100g
        if data.fiber_per_100g is not None:
            food.fiber_per_100g = data.fiber_per_100g
        if data.sugar_per_100g is not None:
            food.sugar_per_100g = data.sugar_per_100g
        if data.sodium_per_100g is not None:
            food.sodium_per_100g = data.sodium_per_100g

        await self.food_repo.commit()
        updated_food = await self.food_repo.get_by_id(food_id)
        assert updated_food is not None
        return updated_food

    async def delete_custom_food(
        self, user_id: uuid.UUID, food_id: uuid.UUID
    ) -> None:
        food = await self.food_repo.get_by_id(food_id)
        if not food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food item not found",
            )

        if food.created_by_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete catalog food items",
            )

        if food.created_by_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this food item",
            )

        food.deleted_at = datetime.now(UTC)
        await self.food_repo.commit()
