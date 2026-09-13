import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class FitnessGoalCreate(BaseModel):
    goal_type: str
    description: str | None = None
    target_value: Decimal | None = None
    target_unit: str | None = None
    target_date: date | None = None


class FitnessGoalUpdate(BaseModel):
    goal_type: str | None = None
    description: str | None = None
    target_value: Decimal | None = None
    target_unit: str | None = None
    target_date: date | None = None
    status: str | None = None


class FitnessGoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    goal_type: str
    description: str | None = None
    target_value: Decimal | None = None
    target_unit: str | None = None
    target_date: date | None = None
    status: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class FitnessGoalListResponse(BaseModel):
    items: list[FitnessGoalRead]
    total: int
