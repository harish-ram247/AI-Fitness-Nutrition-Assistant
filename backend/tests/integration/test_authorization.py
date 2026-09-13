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


@pytest.mark.asyncio
async def test_unauthenticated_requests_rejected(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/users/me")).status_code == 401
    assert (await client.get("/api/v1/profile")).status_code == 401
    assert (await client.get("/api/v1/profile/preferences")).status_code == 401
    assert (await client.get("/api/v1/goals")).status_code == 401
    assert (await client.get("/api/v1/progress/weight")).status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rejected_on_protected_endpoints(client: AsyncClient) -> None:
    await client.post(
        "/api/v1/auth/register",
        json={"email": "type_check@example.com", "password": "Password123!"},
    )
    tokens = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "type_check@example.com", "password": "Password123!"},
        )
    ).json()

    refresh_token = tokens["refresh_token"]

    # Passing refresh token as Bearer token to protected endpoint must fail with 401
    res = await client.get(
        "/api/v1/profile",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert res.status_code == 401
    assert "access token required" in res.json()["detail"]


@pytest.mark.asyncio
async def test_cross_user_isolation(client: AsyncClient) -> None:
    # 1. Register User A and User B
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user_a@example.com", "password": "Password123!"},
    )
    token_a = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "user_a@example.com", "password": "Password123!"},
        )
    ).json()["access_token"]

    await client.post(
        "/api/v1/auth/register",
        json={"email": "user_b@example.com", "password": "Password123!"},
    )
    token_b = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "user_b@example.com", "password": "Password123!"},
        )
    ).json()["access_token"]

    # 2. User B creates a goal
    goal_b = (
        await client.post(
            "/api/v1/goals",
            headers={"Authorization": f"Bearer {token_b}"},
            json={
                "goal_type": "weight_loss",
                "description": "User B's Private Goal",
                "target_value": 75.0,
            },
        )
    ).json()
    goal_b_id = goal_b["id"]

    # 3. User B logs weight
    weight_b = (
        await client.post(
            "/api/v1/progress/weight",
            headers={"Authorization": f"Bearer {token_b}"},
            json={"weight_kg": 85.0, "notes": "User B weigh-in"},
        )
    ).json()
    weight_b_id = weight_b["id"]

    # 4. User A attempts to view goals -> User A does not see User B's goal
    goals_a = (
        await client.get(
            "/api/v1/goals",
            headers={"Authorization": f"Bearer {token_a}"},
        )
    ).json()
    assert all(g["id"] != goal_b_id for g in goals_a["items"])

    # 5. User A attempts to update User B's goal -> rejected with 403 Forbidden
    mod_goal_res = await client.patch(
        f"/api/v1/goals/{goal_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"description": "Hacked by User A"},
    )
    assert mod_goal_res.status_code == 403

    # 6. User A attempts to delete User B's goal -> rejected with 403 Forbidden
    del_goal_res = await client.delete(
        f"/api/v1/goals/{goal_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_goal_res.status_code == 403

    # 7. User A attempts to view weight history -> User A does not see User B's weight
    weight_history_a = (
        await client.get(
            "/api/v1/progress/weight",
            headers={"Authorization": f"Bearer {token_a}"},
        )
    ).json()
    assert all(w["id"] != weight_b_id for w in weight_history_a["entries"])

    # 8. User A attempts to update User B's weight entry -> rejected with 403 Forbidden
    mod_weight_res = await client.patch(
        f"/api/v1/progress/weight/{weight_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"weight_kg": 50.0},
    )
    assert mod_weight_res.status_code == 403

    # 9. User A attempts to delete User B's weight entry -> rejected with 403 Forbidden
    del_weight_res = await client.delete(
        f"/api/v1/progress/weight/{weight_b_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert del_weight_res.status_code == 403
