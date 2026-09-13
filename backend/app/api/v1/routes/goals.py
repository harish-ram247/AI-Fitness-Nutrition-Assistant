import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.goal_repository import GoalRepository
from app.schemas.goal import (
    FitnessGoalCreate,
    FitnessGoalListResponse,
    FitnessGoalRead,
    FitnessGoalUpdate,
)
from app.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


def get_goal_service(db: AsyncSession = Depends(get_db)) -> GoalService:
    return GoalService(GoalRepository(db))


@router.get(
    "",
    response_model=FitnessGoalListResponse,
    status_code=status.HTTP_200_OK,
    summary="List current user fitness goals",
)
async def list_goals(
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Any:
    goals = await goal_service.list_goals(current_user.id, status_filter)
    items = [FitnessGoalRead.model_validate(g) for g in goals]
    return FitnessGoalListResponse(items=items, total=len(items))


@router.post(
    "",
    response_model=FitnessGoalRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new fitness goal",
)
async def create_goal(
    data: FitnessGoalCreate,
    current_user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Any:
    return await goal_service.create_goal(current_user.id, data)


@router.patch(
    "/{goal_id}",
    response_model=FitnessGoalRead,
    status_code=status.HTTP_200_OK,
    summary="Update goal details or status",
)
async def update_goal(
    goal_id: uuid.UUID,
    data: FitnessGoalUpdate,
    current_user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> Any:
    return await goal_service.update_goal(current_user.id, goal_id, data)


@router.delete(
    "/{goal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a fitness goal",
)
async def delete_goal(
    goal_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    goal_service: GoalService = Depends(get_goal_service),
) -> None:
    await goal_service.delete_goal(current_user.id, goal_id)
