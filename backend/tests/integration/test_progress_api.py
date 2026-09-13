from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app


@pytest.fixture
async def client(db_session: AsyncSession) -> Any:
    async def override_get_db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


async def get_auth_headers(
    client: AsyncClient, email: str = "progress_user@example.com"
) -> dict[str, str]:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!"},
    )
    tokens = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_log_weight_and_profile_cache_synchronization(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "cache_sync@example.com")

    # Verify profile current_weight_kg is initially None
    p_res = await client.get("/api/v1/profile", headers=headers)
    assert p_res.json()["current_weight_kg"] is None

    # Log weight entry
    entry_payload = {
        "weight_kg": "80.5",
        "logged_at": "2026-09-01T08:00:00Z",
        "notes": "Morning weigh-in",
    }
    w_res = await client.post("/api/v1/progress/weight", headers=headers, json=entry_payload)
    assert w_res.status_code == 201
    entry = w_res.json()
    assert float(entry["weight_kg"]) == 80.5

    # Verify profile current_weight_kg was synchronized transactionally
    p_res2 = await client.get("/api/v1/profile", headers=headers)
    assert float(p_res2.json()["current_weight_kg"]) == 80.5


@pytest.mark.asyncio
async def test_same_day_duplicate_returns_409(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "duplicate_weight@example.com")

    # 1. Log morning weight on 2026-09-01
    w1 = await client.post(
        "/api/v1/progress/weight",
        headers=headers,
        json={"weight_kg": "75.0", "logged_at": "2026-09-01T07:30:00Z"},
    )
    assert w1.status_code == 201

    # 2. Attempt logging evening weight on the same date (2026-09-01)
    w2 = await client.post(
        "/api/v1/progress/weight",
        headers=headers,
        json={"weight_kg": "76.0", "logged_at": "2026-09-01T20:00:00Z"},
    )
    assert w2.status_code == 409
    assert "already exists" in w2.json()["detail"]


@pytest.mark.asyncio
async def test_weight_history_and_trend(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "trend_check@example.com")

    # 1. First entry: 82.0 kg on 2026-09-01
    await client.post(
        "/api/v1/progress/weight",
        headers=headers,
        json={"weight_kg": "82.0", "logged_at": "2026-09-01T08:00:00Z"},
    )

    # 2. Second entry: 80.0 kg on 2026-09-05 (decreasing trend)
    await client.post(
        "/api/v1/progress/weight",
        headers=headers,
        json={"weight_kg": "80.0", "logged_at": "2026-09-05T08:00:00Z"},
    )

    # 3. Third entry: 78.5 kg on 2026-09-10
    await client.post(
        "/api/v1/progress/weight",
        headers=headers,
        json={"weight_kg": "78.5", "logged_at": "2026-09-10T08:00:00Z"},
    )

    history_res = await client.get("/api/v1/progress/weight", headers=headers)
    assert history_res.status_code == 200
    h = history_res.json()
    assert len(h["entries"]) == 3
    assert float(h["start_weight_kg"]) == 82.0
    assert float(h["current_weight_kg"]) == 78.5
    assert h["trend"] == "decreasing"

    # Test date range filter
    range_res = await client.get(
        "/api/v1/progress/weight?from=2026-09-04&to=2026-09-08",
        headers=headers,
    )
    assert range_res.status_code == 200
    r_data = range_res.json()
    assert len(r_data["entries"]) == 1
    assert r_data["entries"][0]["date"] == "2026-09-05"


@pytest.mark.asyncio
async def test_update_weight_and_cache(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "update_cache@example.com")

    # Create entry
    entry = (
        await client.post(
            "/api/v1/progress/weight",
            headers=headers,
            json={"weight_kg": "85.0", "logged_at": "2026-09-01T08:00:00Z"},
        )
    ).json()

    # Update entry to 84.0 kg
    up_res = await client.patch(
        f"/api/v1/progress/weight/{entry['id']}",
        headers=headers,
        json={"weight_kg": "84.0"},
    )
    assert up_res.status_code == 200
    assert float(up_res.json()["weight_kg"]) == 84.0

    # Profile cache must be updated
    p_res = await client.get("/api/v1/profile", headers=headers)
    assert float(p_res.json()["current_weight_kg"]) == 84.0


@pytest.mark.asyncio
async def test_delete_weight_entry_cache_fallback_and_null(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "delete_cache@example.com")

    # 1. Add entry 1 (older)
    e1 = (
        await client.post(
            "/api/v1/progress/weight",
            headers=headers,
            json={"weight_kg": "90.0", "logged_at": "2026-09-01T08:00:00Z"},
        )
    ).json()

    # 2. Add entry 2 (latest)
    e2 = (
        await client.post(
            "/api/v1/progress/weight",
            headers=headers,
            json={"weight_kg": "88.0", "logged_at": "2026-09-05T08:00:00Z"},
        )
    ).json()

    # Current weight should be 88.0
    p1 = await client.get("/api/v1/profile", headers=headers)
    assert float(p1.json()["current_weight_kg"]) == 88.0

    # 3. Delete latest entry (e2)
    del1 = await client.delete(f"/api/v1/progress/weight/{e2['id']}", headers=headers)
    assert del1.status_code == 204

    # Profile cache should fall back to e1 (90.0)
    p2 = await client.get("/api/v1/profile", headers=headers)
    assert float(p2.json()["current_weight_kg"]) == 90.0

    # 4. Delete remaining entry (e1)
    del2 = await client.delete(f"/api/v1/progress/weight/{e1['id']}", headers=headers)
    assert del2.status_code == 204

    # Profile cache should be reset to None
    p3 = await client.get("/api/v1/profile", headers=headers)
    assert p3.json()["current_weight_kg"] is None
