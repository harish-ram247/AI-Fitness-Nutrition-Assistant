from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.dependencies.database import get_db
from app.main import app


@pytest.mark.asyncio
async def test_health_check_success(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_health_check_database_failure() -> None:
    failing_session = AsyncMock()
    failing_session.execute.side_effect = Exception("DB Connection Refused")

    async def override_failing_db() -> AsyncGenerator[AsyncMock, None]:
        yield failing_session

    app.dependency_overrides[get_db] = override_failing_db
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as client:
        response = await client.get("/api/v1/health")
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["status"] == "unhealthy"
        assert data["detail"]["database"] == "disconnected"

    app.dependency_overrides.clear()
