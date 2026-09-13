import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.exercise_repository import ExerciseRepository
from app.repositories.workout_repository import WorkoutRepository
from app.schemas.workout import (
    WorkoutExerciseCreate,
    WorkoutExerciseRead,
    WorkoutExerciseUpdate,
    WorkoutSessionCreate,
    WorkoutSessionRead,
    WorkoutSessionSummaryResponse,
    WorkoutSessionUpdate,
    WorkoutSetCreate,
    WorkoutSetRead,
    WorkoutSetUpdate,
)
from app.services.workout_service import WorkoutService

router = APIRouter(prefix="/workouts", tags=["workouts"])


def get_workout_service(db: AsyncSession = Depends(get_db)) -> WorkoutService:
    return WorkoutService(
        workout_repo=WorkoutRepository(db),
        exercise_repo=ExerciseRepository(db),
    )


# ============================================================================
# Workout Sessions
# ============================================================================


@router.post(
    "",
    response_model=WorkoutSessionRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workout session (standalone or nested)",
)
async def create_workout(
    data: WorkoutSessionCreate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.create_session(
        user_id=current_user.id, data=data
    )


@router.get(
    "",
    response_model=WorkoutSessionSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get paginated workout history with optional date filtering",
)
async def get_workouts(
    from_date: datetime | None = Query(
        None, description="Filter sessions started on or after this timestamp"
    ),
    to_date: datetime | None = Query(
        None, description="Filter sessions started on or before this timestamp"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.get_sessions(
        user_id=current_user.id,
        from_date=from_date,
        to_date=to_date,
        page=page,
        size=size,
    )


@router.get(
    "/{workout_id}",
    response_model=WorkoutSessionRead,
    status_code=status.HTTP_200_OK,
    summary="Get full workout session details including exercises and sets",
)
async def get_workout(
    workout_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.get_session(
        session_id=workout_id, user_id=current_user.id
    )


@router.patch(
    "/{workout_id}",
    response_model=WorkoutSessionRead,
    status_code=status.HTTP_200_OK,
    summary="Update workout session metadata or timestamps (duration recalculated)",
)
async def update_workout(
    workout_id: uuid.UUID,
    data: WorkoutSessionUpdate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.update_session(
        session_id=workout_id, user_id=current_user.id, data=data
    )


@router.delete(
    "/{workout_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a workout session",
)
async def delete_workout(
    workout_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> None:
    await workout_service.delete_session(
        session_id=workout_id, user_id=current_user.id
    )


# ============================================================================
# Exercises within Session
# ============================================================================


@router.post(
    "/{workout_id}/exercises",
    response_model=WorkoutExerciseRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add an exercise (and optional sets) to a workout session",
)
async def add_exercise_to_workout(
    workout_id: uuid.UUID,
    data: WorkoutExerciseCreate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.add_exercise_to_session(
        session_id=workout_id, user_id=current_user.id, data=data
    )


@router.patch(
    "/{workout_id}/exercises/{exercise_entry_id}",
    response_model=WorkoutExerciseRead,
    status_code=status.HTTP_200_OK,
    summary="Update an exercise entry in a workout session",
)
async def update_exercise_in_workout(
    workout_id: uuid.UUID,
    exercise_entry_id: uuid.UUID,
    data: WorkoutExerciseUpdate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.update_exercise_in_session(
        session_id=workout_id,
        exercise_entry_id=exercise_entry_id,
        user_id=current_user.id,
        data=data,
    )


@router.delete(
    "/{workout_id}/exercises/{exercise_entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove an exercise from a workout session",
)
async def delete_exercise_from_workout(
    workout_id: uuid.UUID,
    exercise_entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> None:
    await workout_service.delete_exercise_from_session(
        session_id=workout_id,
        exercise_entry_id=exercise_entry_id,
        user_id=current_user.id,
    )


# ============================================================================
# Sets within Exercise
# ============================================================================


@router.post(
    "/{workout_id}/exercises/{exercise_entry_id}/sets",
    response_model=WorkoutSetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Add a set to an exercise entry in a workout session",
)
async def add_set_to_exercise(
    workout_id: uuid.UUID,
    exercise_entry_id: uuid.UUID,
    data: WorkoutSetCreate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.add_set_to_exercise(
        session_id=workout_id,
        exercise_entry_id=exercise_entry_id,
        user_id=current_user.id,
        data=data,
    )


@router.patch(
    "/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}",
    response_model=WorkoutSetRead,
    status_code=status.HTTP_200_OK,
    summary="Update a set in an exercise entry",
)
async def update_set(
    workout_id: uuid.UUID,
    exercise_entry_id: uuid.UUID,
    set_id: uuid.UUID,
    data: WorkoutSetUpdate,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> Any:
    return await workout_service.update_set(
        session_id=workout_id,
        exercise_entry_id=exercise_entry_id,
        set_id=set_id,
        user_id=current_user.id,
        data=data,
    )


@router.delete(
    "/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a set from an exercise entry",
)
async def delete_set(
    workout_id: uuid.UUID,
    exercise_entry_id: uuid.UUID,
    set_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    workout_service: WorkoutService = Depends(get_workout_service),
) -> None:
    await workout_service.delete_set(
        session_id=workout_id,
        exercise_entry_id=exercise_entry_id,
        set_id=set_id,
        user_id=current_user.id,
    )
