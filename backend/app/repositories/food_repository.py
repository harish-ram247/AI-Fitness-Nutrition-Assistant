import math
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.models.food import FoodItem, FoodItemServing
from app.repositories.base import BaseRepository


class FoodRepository(BaseRepository):
    async def get_by_id(self, food_id: uuid.UUID) -> FoodItem | None:
        stmt = (
            select(FoodItem)
            .where(FoodItem.id == food_id, FoodItem.deleted_at.is_(None))
            .options(selectinload(FoodItem.servings))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id_scoped(
        self, food_id: uuid.UUID, user_id: uuid.UUID
    ) -> FoodItem | None:
        """Retrieve food item enforcing visibility: public USDA food or owned by user."""
        stmt = (
            select(FoodItem)
            .where(
                FoodItem.id == food_id,
                FoodItem.deleted_at.is_(None),
                or_(
                    FoodItem.created_by_user_id.is_(None),
                    FoodItem.created_by_user_id == user_id,
                ),
            )
            .options(selectinload(FoodItem.servings))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_fdc_id(self, fdc_id: int) -> FoodItem | None:
        stmt = (
            select(FoodItem)
            .where(FoodItem.usda_fdc_id == fdc_id, FoodItem.deleted_at.is_(None))
            .options(selectinload(FoodItem.servings))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_serving_by_id(self, serving_id: uuid.UUID) -> FoodItemServing | None:
        stmt = select(FoodItemServing).where(FoodItemServing.id == serving_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def search_foods(
        self,
        query: str | None = None,
        category: str | None = None,
        page: int = 1,
        size: int = 20,
        user_id: uuid.UUID | None = None,
    ) -> tuple[Sequence[FoodItem], int, int]:
        """Search foods with pagination and visibility filtering (public USDA + user's own foods).

        Returns: (items, total_count, total_pages)
        """
        filters: list[Any] = [FoodItem.deleted_at.is_(None)]

        if user_id is not None:
            filters.append(
                or_(
                    FoodItem.created_by_user_id.is_(None),
                    FoodItem.created_by_user_id == user_id,
                )
            )
        else:
            filters.append(FoodItem.created_by_user_id.is_(None))

        if query and query.strip():
            filters.append(FoodItem.name.ilike(f"%{query.strip()}%"))

        if category and category.strip():
            filters.append(FoodItem.category.ilike(f"%{category.strip()}%"))

        # Total count query
        count_stmt = select(func.count(FoodItem.id)).where(*filters)
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar() or 0

        total_pages = math.ceil(total / size) if total > 0 else 1
        offset = (page - 1) * size

        # Items query
        items_stmt = (
            select(FoodItem)
            .where(*filters)
            .order_by(FoodItem.name.asc(), FoodItem.id.asc())
            .offset(offset)
            .limit(size)
            .options(selectinload(FoodItem.servings))
        )
        items_res = await self.session.execute(items_stmt)
        items = items_res.scalars().all()

        return items, total, total_pages

    async def search_by_name(self, query: str, limit: int = 50) -> Sequence[FoodItem]:
        items, _, _ = await self.search_foods(query=query, size=limit)
        return items

    async def create(self, food_item: FoodItem) -> FoodItem:
        self.session.add(food_item)
        await self.session.commit()
        stmt = (
            select(FoodItem)
            .where(FoodItem.id == food_item.id)
            .options(selectinload(FoodItem.servings))
        )
        res = await self.session.execute(stmt)
        return res.scalar_one()

    async def delete(self, food_item: FoodItem) -> None:
        await self.session.delete(food_item)
        await self.session.commit()

    async def commit(self) -> None:
        await self.session.commit()
