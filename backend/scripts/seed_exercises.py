import asyncio
import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionFactory  # noqa: E402
from app.models.exercise import Exercise  # noqa: E402


async def seed_exercises() -> None:
    seed_path = Path(__file__).resolve().parent.parent / "app" / "db" / "seeds" / "exercises.json"
    with open(seed_path, encoding="utf-8") as f:
        exercises_data = json.load(f)

    print(f"Seeding {len(exercises_data)} exercises from {seed_path}...")
    async with AsyncSessionFactory() as session:
        seeded_count = 0
        for item in exercises_data:
            stmt = select(Exercise).where(
                Exercise.name == item["name"],
                Exercise.created_by_user_id.is_(None),
                Exercise.deleted_at.is_(None),
            )
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                exercise = Exercise(
                    name=item["name"],
                    category=item["category"],
                    muscle_groups=item.get("muscle_groups", []),
                    equipment=item.get("equipment"),
                    description=item.get("description"),
                    instructions=item.get("instructions"),
                    is_verified=True,
                    created_by_user_id=None,
                )
                session.add(exercise)
                seeded_count += 1

        await session.commit()
        print(
            f"Seeded {seeded_count} new exercises. "
            f"(Already present: {len(exercises_data) - seeded_count})"
        )


if __name__ == "__main__":
    asyncio.run(seed_exercises())
