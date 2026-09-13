import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app
from app.models.exercise import Exercise


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
    client: AsyncClient, email: str = "exercise_user@example.com"
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
async def test_system_exercise_visibility_and_search(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user1@example.com")

    # Seed system exercises
    ex1 = Exercise(
        id=uuid.uuid4(),
        name="Barbell Bench Press",
        category="strength",
        muscle_groups=["chest", "triceps", "shoulders"],
        equipment="barbell",
        is_verified=True,
        created_by_user_id=None,
    )
    ex2 = Exercise(
        id=uuid.uuid4(),
        name="Running",
        category="cardio",
        muscle_groups=["quadriceps", "hamstrings", "calves"],
        equipment=None,
        is_verified=True,
        created_by_user_id=None,
    )
    db_session.add_all([ex1, ex2])
    await db_session.commit()

    # Search without filters
    res = await client.get("/api/v1/exercises", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2

    # Filter by category
    res = await client.get("/api/v1/exercises?category=strength", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Barbell Bench Press"

    # Filter by muscle_group
    res = await client.get("/api/v1/exercises?muscle_group=chest", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 1

    # Filter by name query
    res = await client.get("/api/v1/exercises?q=bench", headers=headers)
    assert res.status_code == 200
    assert res.json()["total"] == 1

    # Get single system exercise
    res = await client.get(f"/api/v1/exercises/{ex1.id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Barbell Bench Press"
    assert res.json()["is_verified"] is True
    assert res.json()["created_by_user_id"] is None


@pytest.mark.asyncio
async def test_custom_exercise_crud_and_ownership(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers_user1 = await get_auth_headers(client, "user_crud1@example.com")
    headers_user2 = await get_auth_headers(client, "user_crud2@example.com")

    # 1. Create custom exercise as user 1
    create_payload = {
        "name": "Custom Incline Dumbbell Curl",
        "category": "strength",
        "muscle_groups": ["biceps", "forearms"],
        "equipment": "dumbbell",
        "description": "Seated curl on incline bench",
        "instructions": "Curl dumbbells with palms up",
    }
    res = await client.post("/api/v1/exercises", json=create_payload, headers=headers_user1)
    assert res.status_code == 201
    custom_ex = res.json()
    assert custom_ex["name"] == "Custom Incline Dumbbell Curl"
    assert custom_ex["is_verified"] is False
    assert custom_ex["created_by_user_id"] is not None
    custom_id = custom_ex["id"]

    # 2. User 1 can view it
    res = await client.get(f"/api/v1/exercises/{custom_id}", headers=headers_user1)
    assert res.status_code == 200

    # 3. User 2 CANNOT view it (404 Not Found)
    res = await client.get(f"/api/v1/exercises/{custom_id}", headers=headers_user2)
    assert res.status_code == 404

    # 4. User 2 search does NOT include User 1's custom exercise
    res = await client.get("/api/v1/exercises", headers=headers_user2)
    assert res.status_code == 200
    ids_user2 = [item["id"] for item in res.json()["items"]]
    assert custom_id not in ids_user2

    # 5. User 2 cannot PATCH User 1's custom exercise (404)
    res = await client.patch(
        f"/api/v1/exercises/{custom_id}",
        json={"name": "Hacked Curl"},
        headers=headers_user2,
    )
    assert res.status_code == 404

    # 6. User 2 cannot DELETE User 1's custom exercise (404)
    res = await client.delete(f"/api/v1/exercises/{custom_id}", headers=headers_user2)
    assert res.status_code == 404

    # 7. User 1 can PATCH their own custom exercise
    res = await client.patch(
        f"/api/v1/exercises/{custom_id}",
        json={"name": "Updated Incline Curl", "equipment": "cable"},
        headers=headers_user1,
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Updated Incline Curl"
    assert res.json()["equipment"] == "cable"

    # 8. User 1 can soft delete their own custom exercise
    res = await client.delete(f"/api/v1/exercises/{custom_id}", headers=headers_user1)
    assert res.status_code == 204

    # 9. After soft delete, User 1 cannot view it (404) and it's not in search
    res = await client.get(f"/api/v1/exercises/{custom_id}", headers=headers_user1)
    assert res.status_code == 404

    res = await client.get("/api/v1/exercises", headers=headers_user1)
    assert res.status_code == 200
    ids_user1 = [item["id"] for item in res.json()["items"]]
    assert custom_id not in ids_user1


@pytest.mark.asyncio
async def test_system_exercise_protection(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_protect@example.com")

    # Seed system exercise
    sys_ex = Exercise(
        id=uuid.uuid4(),
        name="Push Up",
        category="strength",
        muscle_groups=["chest", "triceps"],
        is_verified=True,
        created_by_user_id=None,
    )
    db_session.add(sys_ex)
    await db_session.commit()

    # Attempt to PATCH system exercise => 403 Forbidden
    res = await client.patch(
        f"/api/v1/exercises/{sys_ex.id}",
        json={"name": "Modified Push Up"},
        headers=headers,
    )
    assert res.status_code == 403
    assert "Cannot modify system exercises" in res.json()["detail"]

    # Attempt to DELETE system exercise => 403 Forbidden
    res = await client.delete(f"/api/v1/exercises/{sys_ex.id}", headers=headers)
    assert res.status_code == 403
    assert "Cannot delete system exercises" in res.json()["detail"]


@pytest.mark.asyncio
async def test_exercise_pagination(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_page@example.com")

    for i in range(15):
        db_session.add(
            Exercise(
                id=uuid.uuid4(),
                name=f"Exercise {i:02d}",
                category="strength",
                muscle_groups=["core"],
                is_verified=True,
                created_by_user_id=None,
            )
        )
    await db_session.commit()

    res = await client.get("/api/v1/exercises?page=1&size=5", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 15
    assert data["page"] == 1
    assert data["size"] == 5
    assert data["pages"] == 3
    assert len(data["items"]) == 5

    res = await client.get("/api/v1/exercises?page=3&size=5", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 5
