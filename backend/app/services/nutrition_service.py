import uuid
from datetime import UTC, date
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.nutrition import FoodEntry
from app.repositories.food_repository import FoodRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.schemas.nutrition import (
    DailyNutritionSummaryResponse,
    DailyTotals,
    FoodEntryCreate,
    FoodEntryRead,
    FoodEntryUpdate,
    MealSummary,
    NutritionHistoryItem,
    NutritionHistoryResponse,
)
from app.services.nutrition_calculator import (
    calculate_food_nutrients,
    calculate_serving_quantity,
)


class NutritionService:
    def __init__(
        self,
        nutrition_repo: NutritionRepository,
        food_repo: FoodRepository,
    ) -> None:
        self.nutrition_repo = nutrition_repo
        self.food_repo = food_repo

    async def log_food_entry(
        self, user_id: uuid.UUID, data: FoodEntryCreate
    ) -> FoodEntry:
        # 1. Retrieve food item scoped to public USDA foods or owned by user
        food = await self.food_repo.get_by_id_scoped(data.food_item_id, user_id)
        if not food:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food item not found",
            )

        # 2. Determine quantity in grams
        quantity_g: Decimal
        if data.quantity_g is not None:
            quantity_g = data.quantity_g
        else:
            assert data.serving_id is not None
            assert data.serving_count is not None
            serving = await self.food_repo.get_serving_by_id(data.serving_id)
            if not serving:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Serving not found",
                )
            if serving.food_item_id != food.id:
                raise HTTPException(
                    status_code=422,
                    detail="Specified serving does not belong to the selected food item",
                )
            quantity_g = calculate_serving_quantity(serving.grams, data.serving_count)

        # 3. Deterministic calculation of nutrition values
        nutrients = calculate_food_nutrients(
            calories_per_100g=food.calories_per_100g,
            protein_per_100g=food.protein_per_100g,
            carbs_per_100g=food.carbs_per_100g,
            fat_per_100g=food.fat_per_100g,
            quantity_g=quantity_g,
        )

        # 4. Strict timezone normalization to UTC and log_date calculation
        normalized_utc = data.logged_at.astimezone(UTC)
        log_date = normalized_utc.date()

        # 5. Create immutable FoodEntry snapshot
        entry = FoodEntry(
            id=uuid.uuid4(),
            user_id=user_id,
            food_item_id=food.id,
            meal_type=data.meal_type,
            quantity_g=quantity_g,
            food_name_snapshot=food.name,
            calories=nutrients.calories,
            protein_g=nutrients.protein_g,
            carbs_g=nutrients.carbs_g,
            fat_g=nutrients.fat_g,
            data_source_snapshot=food.source,
            usda_fdc_id_snapshot=food.usda_fdc_id,
            usda_dataset_version_snapshot=food.usda_dataset_version,
            logged_at=normalized_utc,
            log_date=log_date,
            entry_source="manual",
        )

        return await self.nutrition_repo.create(entry)

    async def update_food_entry(
        self, user_id: uuid.UUID, entry_id: uuid.UUID, data: FoodEntryUpdate
    ) -> FoodEntry:
        entry = await self.nutrition_repo.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food entry not found",
            )

        if entry.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this food entry",
            )

        # Recalculate quantity and snapshot if quantity or serving changed
        has_qty = data.quantity_g is not None
        has_srv = data.serving_id is not None and data.serving_count is not None

        if has_qty or has_srv:
            food = await self.food_repo.get_by_id(entry.food_item_id)
            if not food:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Underlying food item not found",
                )

            new_qty: Decimal
            if has_qty:
                assert data.quantity_g is not None
                new_qty = data.quantity_g
            else:
                assert data.serving_id is not None
                assert data.serving_count is not None
                serving = await self.food_repo.get_serving_by_id(data.serving_id)
                if not serving:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Serving not found",
                    )
                if serving.food_item_id != food.id:
                    raise HTTPException(
                        status_code=422,
                        detail="Specified serving does not belong to the selected food item",
                    )
                new_qty = calculate_serving_quantity(serving.grams, data.serving_count)

            nutrients = calculate_food_nutrients(
                calories_per_100g=food.calories_per_100g,
                protein_per_100g=food.protein_per_100g,
                carbs_per_100g=food.carbs_per_100g,
                fat_per_100g=food.fat_per_100g,
                quantity_g=new_qty,
            )

            entry.quantity_g = new_qty
            entry.calories = nutrients.calories
            entry.protein_g = nutrients.protein_g
            entry.carbs_g = nutrients.carbs_g
            entry.fat_g = nutrients.fat_g

        if data.meal_type is not None:
            entry.meal_type = data.meal_type

        if data.logged_at is not None:
            normalized_utc = data.logged_at.astimezone(UTC)
            entry.logged_at = normalized_utc
            entry.log_date = normalized_utc.date()

        await self.nutrition_repo.commit()
        await self.nutrition_repo.refresh(entry)
        return entry

    async def delete_food_entry(
        self, user_id: uuid.UUID, entry_id: uuid.UUID
    ) -> None:
        entry = await self.nutrition_repo.get_by_id(entry_id)
        if not entry:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Food entry not found",
            )

        if entry.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this food entry",
            )

        await self.nutrition_repo.soft_delete(entry)

    async def get_daily_summary(
        self, user_id: uuid.UUID, log_date: date
    ) -> DailyNutritionSummaryResponse:
        entries = await self.nutrition_repo.get_by_user_and_date(user_id, log_date)

        total_cals = Decimal("0.00")
        total_prot = Decimal("0.00")
        total_carbs = Decimal("0.00")
        total_fat = Decimal("0.00")

        meals: dict[str, MealSummary] = {
            "breakfast": MealSummary(calories=Decimal("0.00"), entries=[]),
            "lunch": MealSummary(calories=Decimal("0.00"), entries=[]),
            "dinner": MealSummary(calories=Decimal("0.00"), entries=[]),
            "snack": MealSummary(calories=Decimal("0.00"), entries=[]),
        }

        for e in entries:
            total_cals += e.calories
            total_prot += e.protein_g
            total_carbs += e.carbs_g
            total_fat += e.fat_g

            read_entry = FoodEntryRead.model_validate(e)
            if e.meal_type in meals:
                meals[e.meal_type].calories += e.calories
                meals[e.meal_type].entries.append(read_entry)

        return DailyNutritionSummaryResponse(
            date=log_date,
            totals=DailyTotals(
                calories=total_cals,
                protein_g=total_prot,
                carbs_g=total_carbs,
                fat_g=total_fat,
            ),
            meals=meals,
        )

    async def get_history(
        self, user_id: uuid.UUID, start_date: date, end_date: date
    ) -> NutritionHistoryResponse:
        if start_date > end_date:
            raise HTTPException(
                status_code=422,
                detail="start_date cannot be after end_date",
            )

        entries = await self.nutrition_repo.get_by_user_and_date_range(
            user_id, start_date, end_date
        )

        by_date: dict[date, dict[str, Decimal]] = {}
        for e in entries:
            d = e.log_date
            if d not in by_date:
                by_date[d] = {
                    "calories": Decimal("0.00"),
                    "protein_g": Decimal("0.00"),
                    "carbs_g": Decimal("0.00"),
                    "fat_g": Decimal("0.00"),
                }
            by_date[d]["calories"] += e.calories
            by_date[d]["protein_g"] += e.protein_g
            by_date[d]["carbs_g"] += e.carbs_g
            by_date[d]["fat_g"] += e.fat_g

        items = [
            NutritionHistoryItem(
                date=d,
                calories=by_date[d]["calories"],
                protein_g=by_date[d]["protein_g"],
                carbs_g=by_date[d]["carbs_g"],
                fat_g=by_date[d]["fat_g"],
            )
            for d in sorted(by_date.keys())
        ]

        return NutritionHistoryResponse(items=items, total_days=len(items))
