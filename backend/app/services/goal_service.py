import uuid
from collections.abc import Sequence

from fastapi import HTTPException, status

from app.models.goal import FitnessGoal
from app.repositories.goal_repository import GoalRepository
from app.schemas.goal import FitnessGoalCreate, FitnessGoalUpdate


class GoalService:
    def __init__(self, goal_repo: GoalRepository) -> None:
        self.goal_repo = goal_repo

    async def list_goals(
        self, user_id: uuid.UUID, status_filter: str | None = None
    ) -> Sequence[FitnessGoal]:
        return await self.goal_repo.list_by_user(user_id, status=status_filter)

    async def create_goal(
        self, user_id: uuid.UUID, data: FitnessGoalCreate
    ) -> FitnessGoal:
        goal = FitnessGoal(
            user_id=user_id,
            goal_type=data.goal_type,
            description=data.description,
            target_value=data.target_value,
            target_unit=data.target_unit,
            target_date=data.target_date,
            status="active",
        )
        return await self.goal_repo.create(goal)

    async def update_goal(
        self, user_id: uuid.UUID, goal_id: uuid.UUID, data: FitnessGoalUpdate
    ) -> FitnessGoal:
        goal = await self.goal_repo.get_by_id(goal_id)
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        if goal.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this goal",
            )

        if data.goal_type is not None:
            goal.goal_type = data.goal_type
        if data.description is not None:
            goal.description = data.description
        if data.target_value is not None:
            goal.target_value = data.target_value
        if data.target_unit is not None:
            goal.target_unit = data.target_unit
        if data.target_date is not None:
            goal.target_date = data.target_date
        if data.status is not None:
            goal.status = data.status
            if data.status == "completed" and not goal.completed_at:
                from datetime import UTC, datetime
                goal.completed_at = datetime.now(UTC)
            elif data.status != "completed":
                goal.completed_at = None

        await self.goal_repo.commit()
        await self.goal_repo.session.refresh(goal)
        return goal

    async def delete_goal(self, user_id: uuid.UUID, goal_id: uuid.UUID) -> None:
        goal = await self.goal_repo.get_by_id(goal_id)
        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found",
            )

        if goal.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this goal",
            )

        await self.goal_repo.delete(goal)
