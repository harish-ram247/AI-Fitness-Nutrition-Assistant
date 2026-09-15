"""Phase 7B – Pydantic API schemas for meal recommendations."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MealComponentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    food_id: uuid.UUID
    food_name: str
    quantity_g: Decimal
    serving_id: uuid.UUID | None = None
    serving_description: str
    serving_count: Decimal
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class FactorScoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    factor_name: str
    normalized_score: float
    weight: float
    weighted_contribution: float
    reason: str | None = None


class MealRecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    meal_type: str
    components: list[MealComponentResponse]
    total_calories: Decimal
    total_protein_g: Decimal
    total_carbs_g: Decimal
    total_fat_g: Decimal
    score: float
    reasons: list[str]
    factor_scores: list[FactorScoreResponse]


class MealRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recommendation_type: str = "meal"
    meal_type: str
    target_calories: float | None = None
    target_protein_g: float | None = None
    remaining_daily_calories: float | None = None
    items: list[MealRecommendationItem]
    total_generated: int
    total_survived_filtering: int
    disclaimer: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class WorkoutExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise_id: uuid.UUID
    exercise_name: str
    category: str
    muscle_groups: list[str] = Field(default_factory=list)
    equipment: str | None = None
    order_index: int
    recommended_sets: int
    recommended_reps: int | None = None
    recommended_duration_seconds: int | None = None
    recommended_rest_seconds: int


class WorkoutRecommendationItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    workout_type: str
    category: str
    target_muscle_groups: list[str] = Field(default_factory=list)
    estimated_duration_minutes: int
    total_sets: int
    primary_equipment_needed: list[str] = Field(default_factory=list)
    variant: str
    score: float
    reasons: list[str] = Field(default_factory=list)
    factor_scores: list[FactorScoreResponse] = Field(default_factory=list)
    exercises: list[WorkoutExerciseResponse] = Field(default_factory=list)


class WorkoutRecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    recommendation_type: str = "workout"
    target_duration_minutes: int
    workout_type: str | None = None
    items: list[WorkoutRecommendationItem] = Field(default_factory=list)
    total_generated: int
    total_survived_filtering: int
    disclaimer: str
    metadata: dict[str, Any] = Field(default_factory=dict)
