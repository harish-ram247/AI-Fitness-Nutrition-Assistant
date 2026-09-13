import re
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator


def _validate_password(v: str) -> str:
    """Validate password strength according to docs/security.md §4.2 and docs/api-design.md §2."""
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain an uppercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain a digit")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
        raise ValueError("Password must contain a special character")
    return v


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password(v)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 1800


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        return _validate_password(v)


class DeleteAccountRequest(BaseModel):
    password: str


class UserProfileUpdate(BaseModel):
    first_name: str
    last_name: str | None = None
    date_of_birth: date | None = None
    sex: str | None = None
    height_cm: Decimal | None = None
    activity_level: str = "sedentary"

    @field_validator("height_cm")
    @classmethod
    def validate_height(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and (v < Decimal("50.0") or v > Decimal("300.0")):
            raise ValueError("height_cm must be between 50 and 300")
        return v


class UserPreferenceUpdate(BaseModel):
    unit_system: str | None = None
    calorie_target: int | None = None
    protein_target_g: Decimal | None = None
    carbs_target_g: Decimal | None = None
    fat_target_g: Decimal | None = None
    dietary_restrictions: list[str] | None = None
    ai_persona: str | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime


class UserProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    first_name: str
    last_name: str | None = None
    date_of_birth: date | None = None
    sex: str | None = None
    height_cm: Decimal | None = None
    current_weight_kg: Decimal | None = None  # Read-cache derived from weight_entries
    activity_level: str
    created_at: datetime
    updated_at: datetime


class UserPreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    unit_system: str
    calorie_target: int | None = None
    protein_target_g: Decimal | None = None
    carbs_target_g: Decimal | None = None
    fat_target_g: Decimal | None = None
    dietary_restrictions: list[str]
    ai_persona: str
    created_at: datetime
    updated_at: datetime
