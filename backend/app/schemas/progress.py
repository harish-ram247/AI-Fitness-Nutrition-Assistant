import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _validate_weight(v: Decimal | None) -> Decimal | None:
    if v is not None and (v < Decimal("20.0") or v > Decimal("500.0")):
        raise ValueError("weight_kg must be between 20.0 and 500.0")
    return v


class WeightEntryCreate(BaseModel):
    weight_kg: Decimal
    logged_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    notes: str | None = None

    @field_validator("weight_kg")
    @classmethod
    def validate_weight_value(cls, v: Decimal) -> Decimal:
        val = _validate_weight(v)
        assert val is not None
        return val


class WeightEntryUpdate(BaseModel):
    weight_kg: Decimal | None = None
    logged_at: datetime | None = None
    notes: str | None = None

    @field_validator("weight_kg")
    @classmethod
    def validate_weight_value(cls, v: Decimal | None) -> Decimal | None:
        return _validate_weight(v)


class WeightEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    weight_kg: Decimal
    logged_at: datetime
    log_date: date
    notes: str | None = None
    created_at: datetime


class WeightHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    date: date
    weight_kg: Decimal
    notes: str | None = None


class WeightHistoryResponse(BaseModel):
    entries: list[WeightHistoryItem]
    current_weight_kg: Decimal | None = None
    start_weight_kg: Decimal | None = None
    trend: str | None = None
