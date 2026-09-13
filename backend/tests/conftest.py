import os
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

import app.models as _models  # noqa: F401
from app.api.dependencies.database import get_db
from app.main import app as fastapi_app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5434/fitness_tracker_test",
)


@pytest.fixture
def mock_db_session() -> AsyncMock:
    session = AsyncMock(spec=AsyncSession)
    mock_result = MagicMock()
    mock_result.scalar.return_value = 1
    session.execute.return_value = mock_result
    return session


@pytest.fixture
async def async_client(
    mock_db_session: AsyncMock,
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield mock_db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        yield client
    fastapi_app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def test_engine() -> AsyncEngine:
    return create_async_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,
        echo=False,
    )


@pytest.fixture
async def db_session(test_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a real PostgreSQL async session with table cleanup between tests."""
    # Clean tables before each test run to ensure isolation
    async with test_engine.connect() as conn:
        await conn.execute(
            text(
                "TRUNCATE TABLE ai_response_sources, ai_messages, ai_conversations, "
                "document_chunks, knowledge_documents, "
                "weight_entries, workout_sets, workout_exercises, "
                "workout_sessions, exercises, food_entries, food_item_servings, "
                "food_items, fitness_goals, user_preferences, user_profiles, users CASCADE;"
            )
        )
        await conn.commit()

    session_factory = async_sessionmaker(
        test_engine, expire_on_commit=False, class_=AsyncSession
    )

    async with session_factory() as session:
        yield session
        await session.rollback()

