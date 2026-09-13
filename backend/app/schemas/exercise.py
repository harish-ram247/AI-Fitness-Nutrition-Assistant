import uuid
from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

VALID_EXERCISE_CATEGORIES = {"strength", "cardio", "flexibility", "balance"}


class ExerciseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    category: str
    muscle_groups: list[str] = []
    equipment: str | None = None
    description: str | None = None
    instructions: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name cannot be empty")
        if len(trimmed) > 255:
            raise ValueError("name cannot exceed 255 characters")
        return trimmed

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        lowered = v.lower().strip()
        if lowered not in VALID_EXERCISE_CATEGORIES:
            categories = ", ".join(sorted(VALID_EXERCISE_CATEGORIES))
            raise ValueError(f"category must be one of: {categories}")
        return lowered

    @field_validator("muscle_groups")
    @classmethod
    def validate_muscle_groups(cls, v: list[str]) -> list[str]:
        return [m.lower().strip() for m in v if m and m.strip()]


class ExerciseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    category: str | None = None
    muscle_groups: list[str] | None = None
    equipment: str | None = None
    description: str | None = None
    instructions: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("name cannot be empty")
            if len(trimmed) > 255:
                raise ValueError("name cannot exceed 255 characters")
            return trimmed
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str | None) -> str | None:
        if v is not None:
            lowered = v.lower().strip()
            if lowered not in VALID_EXERCISE_CATEGORIES:
                categories = ", ".join(sorted(VALID_EXERCISE_CATEGORIES))
                raise ValueError(f"category must be one of: {categories}")
            return lowered
        return v

    @field_validator("muscle_groups")
    @classmethod
    def validate_muscle_groups(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            return [m.lower().strip() for m in v if m and m.strip()]
        return v

    @model_validator(mode="after")
    def reject_explicit_nulls(self) -> Self:
        for field in ("name", "category", "muscle_groups"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null; omit the field to retain existing value")
        return self


class ExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    muscle_groups: list[str]
    equipment: str | None = None
    description: str | None = None
    instructions: str | None = None
    is_verified: bool
    created_by_user_id: uuid.UUID | None = None
    created_at: datetime


class ExerciseSearchResponse(BaseModel):
    items: list[ExerciseRead]
    total: int
    page: int
    size: int
    pages: int
