import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}


class FoodEntryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_item_id: uuid.UUID
    quantity_g: Decimal | None = None
    serving_id: uuid.UUID | None = None
    serving_count: Decimal | None = None
    meal_type: str
    logged_at: datetime

    @field_validator("meal_type")
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        lowered = v.lower()
        if lowered not in VALID_MEAL_TYPES:
            raise ValueError(f"meal_type must be one of: {', '.join(sorted(VALID_MEAL_TYPES))}")
        return lowered

    @field_validator("logged_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError("logged_at must contain an explicit timezone offset")
        return v

    @model_validator(mode="after")
    def validate_modes(self) -> "FoodEntryCreate":
        has_qty = self.quantity_g is not None
        has_srv = self.serving_id is not None
        has_cnt = self.serving_count is not None

        # Mode A: quantity_g provided
        # Mode B: serving_id AND serving_count provided
        if has_qty and (has_srv or has_cnt):
            raise ValueError("Provide either quantity_g OR serving_id with serving_count, not both")
        if not has_qty and not has_srv and not has_cnt:
            raise ValueError("Must provide either quantity_g or serving_id with serving_count")
        if has_srv and not has_cnt:
            raise ValueError("serving_count is required when serving_id is provided")
        if has_cnt and not has_srv:
            raise ValueError("serving_id is required when serving_count is provided")

        if self.quantity_g is not None and self.quantity_g <= Decimal("0.0"):
            raise ValueError("quantity_g must be strictly greater than zero")
        if self.serving_count is not None and self.serving_count <= Decimal("0.0"):
            raise ValueError("serving_count must be strictly greater than zero")

        return self


class FoodEntryUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Note: food_item_id is strictly immutable and intentionally excluded
    quantity_g: Decimal | None = None
    serving_id: uuid.UUID | None = None
    serving_count: Decimal | None = None
    meal_type: str | None = None
    logged_at: datetime | None = None

    @field_validator("meal_type")
    @classmethod
    def validate_meal_type(cls, v: str | None) -> str | None:
        if v is not None:
            lowered = v.lower()
            if lowered not in VALID_MEAL_TYPES:
                raise ValueError(
                    f"meal_type must be one of: {', '.join(sorted(VALID_MEAL_TYPES))}"
                )
            return lowered
        return v

    @field_validator("logged_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and (v.tzinfo is None or v.tzinfo.utcoffset(v) is None):
            raise ValueError("logged_at must contain an explicit timezone offset")
        return v

    @model_validator(mode="after")
    def validate_update_modes(self) -> "FoodEntryUpdate":
        # Explicit null for quantity/serving or other fields must not silently mean "omitted"
        for field in ("quantity_g", "serving_id", "serving_count", "meal_type", "logged_at"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit the field to retain existing value")

        has_qty = self.quantity_g is not None
        has_srv = self.serving_id is not None
        has_cnt = self.serving_count is not None

        if has_qty and (has_srv or has_cnt):
            raise ValueError("Provide either quantity_g OR serving_id with serving_count, not both")
        if has_srv and not has_cnt:
            raise ValueError("serving_count is required when serving_id is provided")
        if has_cnt and not has_srv:
            raise ValueError("serving_id is required when serving_count is provided")

        if self.quantity_g is not None and self.quantity_g <= Decimal("0.0"):
            raise ValueError("quantity_g must be strictly greater than zero")
        if self.serving_count is not None and self.serving_count <= Decimal("0.0"):
            raise ValueError("serving_count must be strictly greater than zero")

        return self


class FoodEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    food_item_id: uuid.UUID
    meal_type: str
    quantity_g: Decimal
    food_name_snapshot: str
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal
    data_source_snapshot: str
    usda_fdc_id_snapshot: int | None = None
    usda_dataset_version_snapshot: str | None = None
    logged_at: datetime
    log_date: date
    entry_source: str
    created_at: datetime
    updated_at: datetime


class DailyTotals(BaseModel):
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class MealSummary(BaseModel):
    calories: Decimal
    entries: list[FoodEntryRead]


class DailyNutritionSummaryResponse(BaseModel):
    date: date
    totals: DailyTotals
    meals: dict[str, MealSummary]


class NutritionHistoryItem(BaseModel):
    date: date
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class NutritionHistoryResponse(BaseModel):
    items: list[NutritionHistoryItem]
    total_days: int


class NaturalLanguageLogRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=1000)
    meal_type: str = "snack"
    logged_at: datetime

    @field_validator("meal_type")
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        lowered = v.lower()
        if lowered not in VALID_MEAL_TYPES:
            raise ValueError(f"meal_type must be one of: {', '.join(sorted(VALID_MEAL_TYPES))}")
        return lowered

    @field_validator("logged_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError("logged_at must be a timezone-aware datetime with an explicit offset")
        return v


class ResolvedFoodItemPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_text: str
    food_item_id: uuid.UUID
    food_name: str
    quantity_g: Decimal
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal
    confidence: str = "high"


class UnresolvedFoodItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_text: str
    recognized_name: str
    suggested_action: str = "Please search manually for this food item."


class NaturalLanguageLogPreview(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extraction_id: uuid.UUID
    resolved_items: list[ResolvedFoodItemPreview]
    unresolved: list[UnresolvedFoodItem] = []
    total_calories: Decimal
    total_protein_g: Decimal
    total_carbs_g: Decimal
    total_fat_g: Decimal


class ConfirmedFoodItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_item_id: uuid.UUID
    quantity_g: Decimal | None = None
    serving_id: uuid.UUID | None = None
    serving_count: Decimal | None = None
    meal_type: str = "snack"
    logged_at: datetime

    @field_validator("meal_type")
    @classmethod
    def validate_meal_type(cls, v: str) -> str:
        lowered = v.lower()
        if lowered not in VALID_MEAL_TYPES:
            raise ValueError(f"meal_type must be one of: {', '.join(sorted(VALID_MEAL_TYPES))}")
        return lowered

    @field_validator("logged_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.tzinfo.utcoffset(v) is None:
            raise ValueError("logged_at must be a timezone-aware datetime with an explicit offset")
        return v

    @model_validator(mode="after")
    def validate_quantity_mode(self) -> "ConfirmedFoodItem":
        has_direct = self.quantity_g is not None
        has_serving_id = self.serving_id is not None
        has_serving_count = self.serving_count is not None

        if has_direct and (has_serving_id or has_serving_count):
            raise ValueError("Cannot supply both quantity_g and serving information")
        if not has_direct and not (has_serving_id and has_serving_count):
            raise ValueError("Must supply either quantity_g or both serving_id and serving_count")

        if self.quantity_g is not None and self.quantity_g <= Decimal("0"):
            raise ValueError("quantity_g must be strictly greater than 0")
        if self.serving_count is not None and self.serving_count <= Decimal("0"):
            raise ValueError("serving_count must be strictly greater than 0")

        return self


class NaturalLanguageConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmed_items: list[ConfirmedFoodItem] = Field(..., min_length=1)
