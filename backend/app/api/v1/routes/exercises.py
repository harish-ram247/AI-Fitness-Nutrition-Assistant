import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.exercise_repository import ExerciseRepository
from app.schemas.exercise import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSearchResponse,
    ExerciseUpdate,
)
from app.services.exercise_service import ExerciseService

router = APIRouter(prefix="/exercises", tags=["exercises"])


def get_exercise_service(db: AsyncSession = Depends(get_db)) -> ExerciseService:
    return ExerciseService(ExerciseRepository(db))


@router.get(
    "",
    response_model=ExerciseSearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Search exercises with filtering and pagination",
)
async def search_exercises(
    q: str | None = Query(None, description="Search query name string"),
    category: str | None = Query(
        None, description="Category filter (strength, cardio, flexibility, balance)"
    ),
    muscle_group: str | None = Query(None, description="Target muscle group filter"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    exercise_service: ExerciseService = Depends(get_exercise_service),
) -> Any:
    return await exercise_service.search_exercises(
        query=q,
        category=category,
        muscle_group=muscle_group,
        page=page,
        size=size,
        user_id=current_user.id,
    )


@router.get(
    "/{exercise_id}",
    response_model=ExerciseRead,
    status_code=status.HTTP_200_OK,
    summary="Get exercise details",
)
async def get_exercise(
    exercise_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    exercise_service: ExerciseService = Depends(get_exercise_service),
) -> Any:
    return await exercise_service.get_exercise(
        exercise_id=exercise_id, user_id=current_user.id
    )


@router.post(
    "",
    response_model=ExerciseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom exercise",
)
async def create_custom_exercise(
    data: ExerciseCreate,
    current_user: User = Depends(get_current_user),
    exercise_service: ExerciseService = Depends(get_exercise_service),
) -> Any:
    return await exercise_service.create_custom_exercise(
        user_id=current_user.id, data=data
    )


@router.patch(
    "/{exercise_id}",
    response_model=ExerciseRead,
    status_code=status.HTTP_200_OK,
    summary="Update a custom exercise (owner only)",
)
async def update_custom_exercise(
    exercise_id: uuid.UUID,
    data: ExerciseUpdate,
    current_user: User = Depends(get_current_user),
    exercise_service: ExerciseService = Depends(get_exercise_service),
) -> Any:
    return await exercise_service.update_custom_exercise(
        user_id=current_user.id, exercise_id=exercise_id, data=data
    )


@router.delete(
    "/{exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a custom exercise (owner only)",
)
async def delete_custom_exercise(
    exercise_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    exercise_service: ExerciseService = Depends(get_exercise_service),
) -> None:
    await exercise_service.delete_custom_exercise(
        user_id=current_user.id, exercise_id=exercise_id
    )
