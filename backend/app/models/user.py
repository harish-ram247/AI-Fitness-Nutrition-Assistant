import uuid
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.base import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.exercise import Exercise
    from app.models.food import FoodItem
    from app.models.goal import FitnessGoal
    from app.models.nutrition import FoodEntry
    from app.models.progress import WeightEntry
    from app.models.workout import WorkoutSession


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        index=True,
    )
    is_verified: Mapped[bool] = mapped_column(
        default=False,
        nullable=False,
    )

    # Relationships
    profile: Mapped["UserProfile"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    preferences: Mapped["UserPreference"] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    goals: Mapped[list["FitnessGoal"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    weight_entries: Mapped[list["WeightEntry"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    food_entries: Mapped[list["FoodEntry"]] = relationship(
        back_populates="user",
    )
    workout_sessions: Mapped[list["WorkoutSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    custom_foods: Mapped[list["FoodItem"]] = relationship(
        back_populates="creator",
        foreign_keys="FoodItem.created_by_user_id",
    )
    custom_exercises: Mapped[list["Exercise"]] = relationship(
        back_populates="creator",
        foreign_keys="Exercise.created_by_user_id",
    )


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    date_of_birth: Mapped[date | None] = mapped_column(
        Date,
        nullable=True,
    )
    sex: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
    )
    height_cm: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 1),
        nullable=True,
    )
    # Derived read-cache only: service-maintained, authoritative weight in weight_entries
    current_weight_kg: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    activity_level: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="sedentary",
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="profile")


class UserPreference(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    unit_system: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="metric",
    )
    calorie_target: Mapped[int | None] = mapped_column(
        nullable=True,
    )
    protein_target_g: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 1),
        nullable=True,
    )
    carbs_target_g: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 1),
        nullable=True,
    )
    fat_target_g: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 1),
        nullable=True,
    )
    dietary_restrictions: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        default=list,
    )
    ai_persona: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="balanced",
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="preferences")
