import datetime
import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.recommendations.types import RecommendationType


class UserProfileContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    age: int | None = None
    gender: str | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    activity_level: str | None = None


class GoalContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    goal_type: str
    target_value: float | None = None
    target_unit: str | None = None
    description: str | None = None


class PreferencesContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    dietary_restrictions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    disliked_foods: list[str] = Field(default_factory=list)
    preferred_workout_days: list[str] = Field(default_factory=list)
    target_calories: int | None = None
    target_protein_g: float | None = None
    target_carbs_g: float | None = None
    target_fat_g: float | None = None


class NutritionSummaryContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    date: datetime.date | None = None
    calories_consumed: float = 0.0
    protein_consumed_g: float = 0.0
    carbs_consumed_g: float = 0.0
    fat_consumed_g: float = 0.0
    remaining_calories: float | None = None
    remaining_protein_g: float | None = None


class WorkoutSummaryContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    recent_session_count_7d: int = 0
    last_workout_date: datetime.date | None = None
    recent_muscle_groups: list[str] = Field(default_factory=list)


class ConstraintContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    max_preparation_time_minutes: int | None = None
    available_equipment: list[str] = Field(default_factory=list)
    target_duration_minutes: int | None = None
    custom_constraints: dict[str, Any] = Field(default_factory=dict)


class RecommendationContext(BaseModel):
    model_config = ConfigDict(frozen=True)

    user_id: uuid.UUID
    recommendation_type: RecommendationType
    profile: UserProfileContext | None = None
    goal: GoalContext | None = None
    preferences: PreferencesContext | None = None
    nutrition_summary: NutritionSummaryContext | None = None
    workout_summary: WorkoutSummaryContext | None = None
    constraints: ConstraintContext = Field(default_factory=ConstraintContext)
    metadata: dict[str, Any] = Field(default_factory=dict)
