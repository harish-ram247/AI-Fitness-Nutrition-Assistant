import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_validator


class FoodItemServingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    food_item_id: uuid.UUID
    description: str
    grams: Decimal
    is_default: bool


class FoodItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    brand: str | None = None
    barcode: str | None = None
    category: str | None = None
    calories_per_100g: Decimal
    protein_per_100g: Decimal
    carbs_per_100g: Decimal
    fat_per_100g: Decimal
    fiber_per_100g: Decimal | None = None
    sugar_per_100g: Decimal | None = None
    sodium_per_100g: Decimal | None = None
    source: str
    usda_fdc_id: int | None = None
    usda_data_type: str | None = None
    usda_dataset_version: str | None = None
    usda_imported_at: datetime | None = None
    created_by_user_id: uuid.UUID | None = None
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    servings: list[FoodItemServingRead] = []


class FoodSearchResponse(BaseModel):
    items: list[FoodItemRead]
    total: int
    page: int
    size: int
    pages: int


class ServingCreate(BaseModel):
    description: str
    grams: Decimal
    is_default: bool = False

    @field_validator("grams")
    @classmethod
    def validate_grams(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0.0"):
            raise ValueError("grams must be strictly greater than zero")
        return v


class CustomFoodCreate(BaseModel):
    name: str
    brand: str | None = None
    category: str | None = None
    calories_per_100g: Decimal
    protein_per_100g: Decimal
    carbs_per_100g: Decimal
    fat_per_100g: Decimal
    fiber_per_100g: Decimal | None = None
    sugar_per_100g: Decimal | None = None
    sodium_per_100g: Decimal | None = None
    servings: list[ServingCreate] = []

    @field_validator(
        "calories_per_100g",
        "protein_per_100g",
        "carbs_per_100g",
        "fat_per_100g",
    )
    @classmethod
    def validate_positive_macros(cls, v: Decimal) -> Decimal:
        if v < Decimal("0.0"):
            raise ValueError("Nutritional values cannot be negative")
        return v


class CustomFoodUpdate(BaseModel):
    name: str | None = None
    brand: str | None = None
    category: str | None = None
    calories_per_100g: Decimal | None = None
    protein_per_100g: Decimal | None = None
    carbs_per_100g: Decimal | None = None
    fat_per_100g: Decimal | None = None
    fiber_per_100g: Decimal | None = None
    sugar_per_100g: Decimal | None = None
    sodium_per_100g: Decimal | None = None

    @field_validator(
        "calories_per_100g",
        "protein_per_100g",
        "carbs_per_100g",
        "fat_per_100g",
    )
    @classmethod
    def validate_positive_macros(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0.0"):
            raise ValueError("Nutritional values cannot be negative")
        return v
