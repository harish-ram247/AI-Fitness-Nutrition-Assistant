import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.nutrition import FoodEntry
    from app.models.user import User


class FoodItem(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "food_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    brand: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    barcode: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
        index=True,
    )
    category: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    calories_per_100g: Mapped[Decimal] = mapped_column(
        Numeric(7, 2),
        nullable=False,
    )
    protein_per_100g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    carbs_per_100g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    fat_per_100g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    fiber_per_100g: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    sugar_per_100g: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    sodium_per_100g: Mapped[Decimal | None] = mapped_column(
        Numeric(7, 2),
        nullable=True,
    )
    source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="usda",
        index=True,
    )
    usda_fdc_id: Mapped[int | None] = mapped_column(
        Integer,
        unique=True,
        nullable=True,
    )
    usda_data_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    usda_dataset_version: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    usda_imported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    creator: Mapped["User | None"] = relationship(
        back_populates="custom_foods",
        foreign_keys=[created_by_user_id],
    )
    servings: Mapped[list["FoodItemServing"]] = relationship(
        back_populates="food_item",
        cascade="all, delete-orphan",
    )
    entries: Mapped[list["FoodEntry"]] = relationship(
        back_populates="food_item",
    )

    __table_args__ = (
        Index("ix_food_items_name_lower", "name"),
    )


class FoodItemServing(Base):
    __tablename__ = "food_item_servings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    food_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    grams: Mapped[Decimal] = mapped_column(
        Numeric(7, 2),
        nullable=False,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    food_item: Mapped["FoodItem"] = relationship(back_populates="servings")
