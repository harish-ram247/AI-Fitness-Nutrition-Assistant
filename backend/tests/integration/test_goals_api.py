import uuid
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
    client: AsyncClient, email: str = "goal_user@example.com"
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
async def test_create_and_list_goals(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "goals_list@example.com")

    # 1. Create first goal
    g1_data = {
        "goal_type": "weight_loss",
        "description": "Drop to 75kg",
        "target_value": "75.0",
        "target_unit": "kg",
        "target_date": "2026-12-31",
    }
    res1 = await client.post("/api/v1/goals", headers=headers, json=g1_data)
    assert res1.status_code == 201
    g1 = res1.json()
    assert g1["goal_type"] == "weight_loss"
    assert g1["status"] == "active"
    assert float(g1["target_value"]) == 75.0

    # 2. Create second goal
    g2_data = {
        "goal_type": "strength",
        "description": "Bench 100kg",
        "target_value": "100.0",
        "target_unit": "kg",
    }
    res2 = await client.post("/api/v1/goals", headers=headers, json=g2_data)
    assert res2.status_code == 201

    # 3. List goals
    list_res = await client.get("/api/v1/goals", headers=headers)
    assert list_res.status_code == 200
    data = list_res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2


@pytest.mark.asyncio
async def test_filter_goals_by_status(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "goals_filter@example.com")

    # Create goal 1 (active)
    await client.post(
        "/api/v1/goals",
        headers=headers,
        json={"goal_type": "active_goal"},
    )
    # Create goal 2 and mark completed
    g2 = (
        await client.post(
            "/api/v1/goals",
            headers=headers,
            json={"goal_type": "to_complete"},
        )
    ).json()
    await client.patch(
        f"/api/v1/goals/{g2['id']}",
        headers=headers,
        json={"status": "completed"},
    )

    # Filter by active
    active_res = await client.get("/api/v1/goals?status=active", headers=headers)
    assert active_res.status_code == 200
    assert active_res.json()["total"] == 1
    assert active_res.json()["items"][0]["goal_type"] == "active_goal"

    # Filter by completed
    comp_res = await client.get("/api/v1/goals?status=completed", headers=headers)
    assert comp_res.status_code == 200
    assert comp_res.json()["total"] == 1
    assert comp_res.json()["items"][0]["goal_type"] == "to_complete"
    assert comp_res.json()["items"][0]["completed_at"] is not None


@pytest.mark.asyncio
async def test_update_and_delete_goal(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "goals_crud@example.com")

    # Create
    g = (
        await client.post(
            "/api/v1/goals",
            headers=headers,
            json={"goal_type": "cardio", "target_value": "5.0"},
        )
    ).json()
    goal_id = g["id"]

    # Update
    up_res = await client.patch(
        f"/api/v1/goals/{goal_id}",
        headers=headers,
        json={"target_value": "10.0", "description": "Run 10k"},
    )
    assert up_res.status_code == 200
    assert float(up_res.json()["target_value"]) == 10.0
    assert up_res.json()["description"] == "Run 10k"

    # Delete
    del_res = await client.delete(f"/api/v1/goals/{goal_id}", headers=headers)
    assert del_res.status_code == 204

    # List should now be empty
    list_res = await client.get("/api/v1/goals", headers=headers)
    assert list_res.json()["total"] == 0


@pytest.mark.asyncio
async def test_goal_not_found_handling(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "goals_404@example.com")
    fake_id = str(uuid.uuid4())

    del_res = await client.delete(f"/api/v1/goals/{fake_id}", headers=headers)
    assert del_res.status_code == 404

    patch_res = await client.patch(
        f"/api/v1/goals/{fake_id}",
        headers=headers,
        json={"description": "Ghost goal"},
    )
    assert patch_res.status_code == 404
