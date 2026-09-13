import uuid

from fastapi import HTTPException, status

from app.models.exercise import Exercise
from app.repositories.exercise_repository import ExerciseRepository
from app.schemas.exercise import (
    ExerciseCreate,
    ExerciseRead,
    ExerciseSearchResponse,
    ExerciseUpdate,
)


class ExerciseService:
    def __init__(self, exercise_repo: ExerciseRepository) -> None:
        self.exercise_repo = exercise_repo

    async def search_exercises(
        self,
        query: str | None = None,
        category: str | None = None,
        muscle_group: str | None = None,
        page: int = 1,
        size: int = 20,
        user_id: uuid.UUID | None = None,
    ) -> ExerciseSearchResponse:
        if page < 1:
            page = 1
        if size < 1 or size > 100:
            size = 20

        items, total, pages = await self.exercise_repo.search_exercises(
            query=query,
            category=category,
            muscle_group=muscle_group,
            page=page,
            size=size,
            user_id=user_id,
        )
        item_reads = [ExerciseRead.model_validate(item) for item in items]
        return ExerciseSearchResponse(
            items=item_reads,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_exercise(
        self, exercise_id: uuid.UUID, user_id: uuid.UUID
    ) -> Exercise:
        exercise = await self.exercise_repo.get_by_id_scoped(exercise_id, user_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )
        return exercise

    async def create_custom_exercise(
        self, user_id: uuid.UUID, data: ExerciseCreate
    ) -> Exercise:
        exercise = Exercise(
            id=uuid.uuid4(),
            name=data.name,
            category=data.category,
            muscle_groups=data.muscle_groups,
            equipment=data.equipment,
            description=data.description,
            instructions=data.instructions,
            is_verified=False,
            created_by_user_id=user_id,
        )
        return await self.exercise_repo.create(exercise)

    async def update_custom_exercise(
        self, user_id: uuid.UUID, exercise_id: uuid.UUID, data: ExerciseUpdate
    ) -> Exercise:
        exercise = await self.exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )

        if exercise.created_by_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify system exercises",
            )

        if exercise.created_by_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(exercise, field, value)

        await self.exercise_repo.commit()
        return exercise

    async def delete_custom_exercise(
        self, user_id: uuid.UUID, exercise_id: uuid.UUID
    ) -> None:
        exercise = await self.exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )

        if exercise.created_by_user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete system exercises",
            )

        if exercise.created_by_user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Exercise not found",
            )

        await self.exercise_repo.soft_delete(exercise)
