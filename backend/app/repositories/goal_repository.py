import uuid
from collections.abc import Sequence

from sqlalchemy import select

from app.models.goal import FitnessGoal
from app.repositories.base import BaseRepository


class GoalRepository(BaseRepository):
    async def get_by_id(self, goal_id: uuid.UUID) -> FitnessGoal | None:
        stmt = select(FitnessGoal).where(FitnessGoal.id == goal_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_user(
        self, user_id: uuid.UUID, status: str | None = None
    ) -> Sequence[FitnessGoal]:
        stmt = select(FitnessGoal).where(FitnessGoal.user_id == user_id)
        if status:
            stmt = stmt.where(FitnessGoal.status == status)
        stmt = stmt.order_by(FitnessGoal.created_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def create(self, goal: FitnessGoal) -> FitnessGoal:
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def delete(self, goal: FitnessGoal) -> None:
        await self.session.delete(goal)
        await self.session.commit()

    async def commit(self) -> None:
        await self.session.commit()
