import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.food import FoodItem
    from app.models.user import User


class FoodEntry(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "food_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    food_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("food_items.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    meal_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    quantity_g: Mapped[Decimal] = mapped_column(
        Numeric(7, 2),
        nullable=False,
    )

    # Immutable snapshot columns (frozen at insert time for historical accuracy)
    food_name_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    calories: Mapped[Decimal] = mapped_column(
        Numeric(7, 2),
        nullable=False,
    )
    protein_g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    carbs_g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    fat_g: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
    )
    data_source_snapshot: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    usda_fdc_id_snapshot: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    usda_dataset_version_snapshot: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    logged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    log_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    entry_source: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="manual",
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="food_entries")
    food_item: Mapped["FoodItem"] = relationship(back_populates="entries")

    __table_args__ = (
        Index("ix_food_entries_user_id_log_date", "user_id", "log_date"),
        Index("ix_food_entries_user_meal_date", "user_id", "meal_type", "log_date"),
    )
