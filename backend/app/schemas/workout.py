import uuid
from datetime import datetime
from decimal import Decimal
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.schemas.exercise import ExerciseRead

VALID_SET_TYPES = {"warmup", "working", "drop_set", "failure"}


# ============================================================================
# Workout Set Schemas
# ============================================================================


class WorkoutSetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    set_number: int
    set_type: str = "working"
    reps: int | None = None
    weight_kg: Decimal | None = None
    duration_seconds: int | None = None
    distance_m: Decimal | None = None
    rpe: Decimal | None = None
    completed: bool = True

    @field_validator("set_number")
    @classmethod
    def validate_set_number(cls, v: int) -> int:
        if v < 1:
            raise ValueError("set_number must be strictly greater than or equal to 1")
        return v

    @field_validator("set_type")
    @classmethod
    def validate_set_type(cls, v: str) -> str:
        lowered = v.lower().strip()
        if lowered not in VALID_SET_TYPES:
            allowed = ", ".join(sorted(VALID_SET_TYPES))
            raise ValueError(f"set_type must be one of: {allowed}")
        return lowered

    @field_validator("reps")
    @classmethod
    def validate_reps(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("reps cannot be negative")
        return v

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0.0"):
            raise ValueError("weight_kg cannot be negative")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def validate_duration(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("duration_seconds cannot be negative")
        return v

    @field_validator("distance_m")
    @classmethod
    def validate_distance(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0.0"):
            raise ValueError("distance_m cannot be negative")
        return v

    @field_validator("rpe")
    @classmethod
    def validate_rpe(cls, v: Decimal | None) -> Decimal | None:
        if v is not None:
            if v < Decimal("1.0") or v > Decimal("10.0"):
                raise ValueError("rpe must be between 1.0 and 10.0")
            # Verify 0.5 increments (e.g. 7.0, 7.5, 8.0)
            if (v * 2) % 1 != 0:
                raise ValueError("rpe must be in 0.5 increments")
        return v


class WorkoutSetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    set_number: int | None = None
    set_type: str | None = None
    reps: int | None = None
    weight_kg: Decimal | None = None
    duration_seconds: int | None = None
    distance_m: Decimal | None = None
    rpe: Decimal | None = None
    completed: bool | None = None

    @field_validator("set_number")
    @classmethod
    def validate_set_number(cls, v: int | None) -> int | None:
        if v is not None and v < 1:
            raise ValueError("set_number must be strictly greater than or equal to 1")
        return v

    @field_validator("set_type")
    @classmethod
    def validate_set_type(cls, v: str | None) -> str | None:
        if v is not None:
            lowered = v.lower().strip()
            if lowered not in VALID_SET_TYPES:
                allowed = ", ".join(sorted(VALID_SET_TYPES))
                raise ValueError(f"set_type must be one of: {allowed}")
            return lowered
        return v

    @field_validator("reps")
    @classmethod
    def validate_reps(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("reps cannot be negative")
        return v

    @field_validator("weight_kg")
    @classmethod
    def validate_weight(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0.0"):
            raise ValueError("weight_kg cannot be negative")
        return v

    @field_validator("duration_seconds")
    @classmethod
    def validate_duration(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("duration_seconds cannot be negative")
        return v

    @field_validator("distance_m")
    @classmethod
    def validate_distance(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v < Decimal("0.0"):
            raise ValueError("distance_m cannot be negative")
        return v

    @field_validator("rpe")
    @classmethod
    def validate_rpe(cls, v: Decimal | None) -> Decimal | None:
        if v is not None:
            if v < Decimal("1.0") or v > Decimal("10.0"):
                raise ValueError("rpe must be between 1.0 and 10.0")
            if (v * 2) % 1 != 0:
                raise ValueError("rpe must be in 0.5 increments")
        return v

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        for field in ("set_number", "set_type", "completed"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit the field to retain existing value")
        return self


class WorkoutSetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workout_exercise_id: uuid.UUID
    set_number: int
    set_type: str
    reps: int | None = None
    weight_kg: Decimal | None = None
    duration_seconds: int | None = None
    distance_m: Decimal | None = None
    rpe: Decimal | None = None
    completed: bool
    created_at: datetime


# ============================================================================
# Workout Exercise Schemas
# ============================================================================


class WorkoutExerciseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exercise_id: uuid.UUID
    order_index: int = 0
    notes: str | None = None
    sets: list[WorkoutSetCreate] = []

    @field_validator("order_index")
    @classmethod
    def validate_order(cls, v: int) -> int:
        if v < 0:
            raise ValueError("order_index cannot be negative")
        return v


class WorkoutExerciseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_index: int | None = None
    notes: str | None = None

    @field_validator("order_index")
    @classmethod
    def validate_order(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("order_index cannot be negative")
        return v

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        if "order_index" in self.model_fields_set and self.order_index is None:
            raise ValueError("order_index cannot be null; omit the field to retain existing value")
        return self


class WorkoutExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    workout_session_id: uuid.UUID
    exercise_id: uuid.UUID
    order_index: int
    notes: str | None = None
    exercise: ExerciseRead | None = None
    sets: list[WorkoutSetRead] = []


# ============================================================================
# Workout Session Schemas
# ============================================================================


class WorkoutSessionCreate(BaseModel):
    # Note: duration_minutes is intentionally NOT accepted (purely derived)
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    notes: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    tags: list[str] = []
    exercises: list[WorkoutExerciseCreate] = []

    @field_validator("started_at", "ended_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and (v.tzinfo is None or v.tzinfo.utcoffset(v) is None):
            raise ValueError("Timestamp must contain an explicit timezone offset")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        return [t.lower().strip() for t in v if t and t.strip()]

    @model_validator(mode="after")
    def validate_timestamps(self) -> Self:
        if self.ended_at is not None and self.started_at is not None:
            if self.ended_at < self.started_at:
                raise ValueError("ended_at cannot be earlier than started_at")
        return self


class WorkoutSessionUpdate(BaseModel):
    # Note: duration_minutes is intentionally NOT accepted (purely derived)
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    notes: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    tags: list[str] | None = None

    @field_validator("started_at", "ended_at")
    @classmethod
    def validate_timezone_aware(cls, v: datetime | None) -> datetime | None:
        if v is not None and (v.tzinfo is None or v.tzinfo.utcoffset(v) is None):
            raise ValueError("Timestamp must contain an explicit timezone offset")
        return v

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            return [t.lower().strip() for t in v if t and t.strip()]
        return v

    @model_validator(mode="after")
    def validate_update(self) -> Self:
        if "started_at" in self.model_fields_set and self.started_at is None:
            raise ValueError("started_at cannot be null; omit the field to retain existing value")
        if "tags" in self.model_fields_set and self.tags is None:
            raise ValueError("tags cannot be null; omit the field to retain existing value")

        if self.ended_at is not None and self.started_at is not None:
            if self.ended_at < self.started_at:
                raise ValueError("ended_at cannot be earlier than started_at")
        return self


class WorkoutSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None = None
    notes: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    duration_minutes: int | None = None
    tags: list[str]
    created_at: datetime
    exercises: list[WorkoutExerciseRead] = []


class WorkoutSessionSummaryResponse(BaseModel):
    items: list[WorkoutSessionRead]
    total: int
    page: int
    size: int
    pages: int
