import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status

from app.models.workout import WorkoutExercise, WorkoutSession, WorkoutSet
from app.repositories.exercise_repository import ExerciseRepository
from app.repositories.workout_repository import WorkoutRepository
from app.schemas.workout import (
    WorkoutExerciseCreate,
    WorkoutExerciseUpdate,
    WorkoutSessionCreate,
    WorkoutSessionRead,
    WorkoutSessionSummaryResponse,
    WorkoutSessionUpdate,
    WorkoutSetCreate,
    WorkoutSetUpdate,
)


def _compute_duration(started_at: datetime, ended_at: datetime | None) -> int | None:
    """Derive duration_minutes from started_at and ended_at."""
    if ended_at is None:
        return None
    seconds = (ended_at - started_at).total_seconds()
    return round(seconds / 60)


class WorkoutService:
    def __init__(
        self,
        workout_repo: WorkoutRepository,
        exercise_repo: ExerciseRepository,
    ) -> None:
        self.workout_repo = workout_repo
        self.exercise_repo = exercise_repo

    async def get_sessions(
        self,
        user_id: uuid.UUID,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        page: int = 1,
        size: int = 20,
    ) -> WorkoutSessionSummaryResponse:
        if page < 1:
            page = 1
        if size < 1 or size > 100:
            size = 20

        if from_date is not None and from_date.tzinfo is not None:
            from_date = from_date.astimezone(UTC)
        if to_date is not None and to_date.tzinfo is not None:
            to_date = to_date.astimezone(UTC)

        items, total, pages = await self.workout_repo.get_sessions_by_user(
            user_id=user_id,
            from_date=from_date,
            to_date=to_date,
            page=page,
            size=size,
        )

        item_reads = [WorkoutSessionRead.model_validate(item) for item in items]
        return WorkoutSessionSummaryResponse(
            items=item_reads,
            total=total,
            page=page,
            size=size,
            pages=pages,
        )

    async def get_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> WorkoutSession:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )
        return session

    async def create_session(
        self, user_id: uuid.UUID, data: WorkoutSessionCreate
    ) -> WorkoutSession:
        started_at_utc = data.started_at.astimezone(UTC)
        ended_at_utc = (
            data.ended_at.astimezone(UTC) if data.ended_at is not None else None
        )

        if ended_at_utc is not None and ended_at_utc < started_at_utc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ended_at cannot be earlier than started_at",
            )

        duration_minutes = _compute_duration(started_at_utc, ended_at_utc)
        session_id = uuid.uuid4()

        session = WorkoutSession(
            id=session_id,
            user_id=user_id,
            name=data.name,
            notes=data.notes,
            started_at=started_at_utc,
            ended_at=ended_at_utc,
            duration_minutes=duration_minutes,
            tags=data.tags,
        )

        # Validate nested exercises and sets
        for ex_in in data.exercises:
            # Exercise must exist and be visible to user
            exercise = await self.exercise_repo.get_by_id_scoped(
                ex_in.exercise_id, user_id
            )
            if not exercise:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Exercise {ex_in.exercise_id} not found or not visible",
                )

            # Check duplicate set numbers in payload
            seen_set_numbers: set[int] = set()
            for s_in in ex_in.sets:
                if s_in.set_number in seen_set_numbers:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Duplicate set_number {s_in.set_number} within exercise",
                    )
                seen_set_numbers.add(s_in.set_number)

            we_id = uuid.uuid4()
            we = WorkoutExercise(
                id=we_id,
                workout_session_id=session_id,
                exercise_id=ex_in.exercise_id,
                order_index=ex_in.order_index,
                notes=ex_in.notes,
            )

            for s_in in ex_in.sets:
                ws = WorkoutSet(
                    id=uuid.uuid4(),
                    workout_exercise_id=we_id,
                    set_number=s_in.set_number,
                    set_type=s_in.set_type,
                    reps=s_in.reps,
                    weight_kg=s_in.weight_kg,
                    duration_seconds=s_in.duration_seconds,
                    distance_m=s_in.distance_m,
                    rpe=s_in.rpe,
                    completed=s_in.completed,
                )
                we.sets.append(ws)

            session.exercises.append(we)

        return await self.workout_repo.create_session(session)

    async def update_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WorkoutSessionUpdate,
    ) -> WorkoutSession:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        update_data = data.model_dump(exclude_unset=True)

        new_started = (
            data.started_at.astimezone(UTC)
            if data.started_at is not None
            else session.started_at
        )
        new_ended = (
            data.ended_at.astimezone(UTC)
            if "ended_at" in update_data and data.ended_at is not None
            else (None if "ended_at" in update_data and data.ended_at is None else session.ended_at)
        )

        if new_ended is not None and new_ended < new_started:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="ended_at cannot be earlier than started_at",
            )

        if "name" in update_data:
            session.name = data.name
        if "notes" in update_data:
            session.notes = data.notes
        if "tags" in update_data and data.tags is not None:
            session.tags = data.tags

        if "started_at" in update_data or "ended_at" in update_data:
            session.started_at = new_started
            session.ended_at = new_ended
            session.duration_minutes = _compute_duration(new_started, new_ended)

        await self.workout_repo.commit()
        # Reload to get ordered nested relationships
        reloaded = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        assert reloaded is not None
        return reloaded

    async def delete_session(
        self, session_id: uuid.UUID, user_id: uuid.UUID
    ) -> None:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )
        await self.workout_repo.soft_delete_session(session)

    # ========================================================================
    # Workout Exercises
    # ========================================================================

    async def add_exercise_to_session(
        self,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WorkoutExerciseCreate,
    ) -> WorkoutExercise:
        # Hierarchical check: verify session belongs to user
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        # Exercise visibility check
        exercise = await self.exercise_repo.get_by_id_scoped(data.exercise_id, user_id)
        if not exercise:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exercise {data.exercise_id} not found or not visible",
            )

        # Check duplicate set numbers in payload
        seen_set_numbers: set[int] = set()
        for s_in in data.sets:
            if s_in.set_number in seen_set_numbers:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Duplicate set_number {s_in.set_number} within exercise",
                )
            seen_set_numbers.add(s_in.set_number)

        we_id = uuid.uuid4()
        we = WorkoutExercise(
            id=we_id,
            workout_session_id=session_id,
            exercise_id=data.exercise_id,
            order_index=data.order_index,
            notes=data.notes,
        )

        for s_in in data.sets:
            ws = WorkoutSet(
                id=uuid.uuid4(),
                workout_exercise_id=we_id,
                set_number=s_in.set_number,
                set_type=s_in.set_type,
                reps=s_in.reps,
                weight_kg=s_in.weight_kg,
                duration_seconds=s_in.duration_seconds,
                distance_m=s_in.distance_m,
                rpe=s_in.rpe,
                completed=s_in.completed,
            )
            we.sets.append(ws)

        return await self.workout_repo.add_workout_exercise(we)

    async def update_exercise_in_session(
        self,
        session_id: uuid.UUID,
        exercise_entry_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WorkoutExerciseUpdate,
    ) -> WorkoutExercise:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        we = await self.workout_repo.get_workout_exercise(exercise_entry_id, session_id)
        if not we:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout exercise not found in this session",
            )

        update_data = data.model_dump(exclude_unset=True)
        if "order_index" in update_data and data.order_index is not None:
            we.order_index = data.order_index
        if "notes" in update_data:
            we.notes = data.notes

        await self.workout_repo.commit()
        return we

    async def delete_exercise_from_session(
        self,
        session_id: uuid.UUID,
        exercise_entry_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        we = await self.workout_repo.get_workout_exercise(exercise_entry_id, session_id)
        if not we:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout exercise not found in this session",
            )

        await self.workout_repo.delete_workout_exercise(we)

    # ========================================================================
    # Workout Sets
    # ========================================================================

    async def add_set_to_exercise(
        self,
        session_id: uuid.UUID,
        exercise_entry_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WorkoutSetCreate,
    ) -> WorkoutSet:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        we = await self.workout_repo.get_workout_exercise(exercise_entry_id, session_id)
        if not we:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout exercise not found in this session",
            )

        duplicate = await self.workout_repo.check_duplicate_set_number(
            exercise_entry_id, data.set_number
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Set number {data.set_number} already exists for this exercise",
            )

        ws = WorkoutSet(
            id=uuid.uuid4(),
            workout_exercise_id=exercise_entry_id,
            set_number=data.set_number,
            set_type=data.set_type,
            reps=data.reps,
            weight_kg=data.weight_kg,
            duration_seconds=data.duration_seconds,
            distance_m=data.distance_m,
            rpe=data.rpe,
            completed=data.completed,
        )
        return await self.workout_repo.add_workout_set(ws)

    async def update_set(
        self,
        session_id: uuid.UUID,
        exercise_entry_id: uuid.UUID,
        set_id: uuid.UUID,
        user_id: uuid.UUID,
        data: WorkoutSetUpdate,
    ) -> WorkoutSet:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        we = await self.workout_repo.get_workout_exercise(exercise_entry_id, session_id)
        if not we:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout exercise not found in this session",
            )

        ws = await self.workout_repo.get_workout_set(set_id, exercise_entry_id)
        if not ws:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout set not found in this exercise",
            )

        update_data = data.model_dump(exclude_unset=True)

        if "set_number" in update_data and data.set_number is not None:
            if data.set_number != ws.set_number:
                duplicate = await self.workout_repo.check_duplicate_set_number(
                    exercise_entry_id, data.set_number, exclude_set_id=set_id
                )
                if duplicate:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Set number {data.set_number} already exists for this exercise",
                    )
                ws.set_number = data.set_number

        for field in (
            "set_type",
            "reps",
            "weight_kg",
            "duration_seconds",
            "distance_m",
            "rpe",
            "completed",
        ):
            if field in update_data:
                setattr(ws, field, getattr(data, field))

        await self.workout_repo.commit()
        return ws

    async def delete_set(
        self,
        session_id: uuid.UUID,
        exercise_entry_id: uuid.UUID,
        set_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        session = await self.workout_repo.get_session_by_id_and_user(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout session not found",
            )

        we = await self.workout_repo.get_workout_exercise(exercise_entry_id, session_id)
        if not we:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout exercise not found in this session",
            )

        ws = await self.workout_repo.get_workout_set(set_id, exercise_entry_id)
        if not ws:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Workout set not found in this exercise",
            )

        await self.workout_repo.delete_workout_set(ws)
