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
    client: AsyncClient, email: str = "profile_user@example.com"
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
async def test_get_profile_success(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "get_profile@example.com")
    res = await client.get("/api/v1/profile", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["first_name"] == "Get_profile"
    assert data["activity_level"] == "sedentary"
    assert data["current_weight_kg"] is None


@pytest.mark.asyncio
async def test_update_profile_success(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "update_profile@example.com")
    update_data = {
        "first_name": "Marcus",
        "last_name": "Aurelius",
        "date_of_birth": "1990-04-26",
        "sex": "male",
        "height_cm": "178.5",
        "activity_level": "moderate",
    }
    res = await client.put("/api/v1/profile", headers=headers, json=update_data)
    assert res.status_code == 200
    data = res.json()
    assert data["first_name"] == "Marcus"
    assert data["last_name"] == "Aurelius"
    assert data["date_of_birth"] == "1990-04-26"
    assert data["sex"] == "male"
    assert float(data["height_cm"]) == 178.5
    assert data["activity_level"] == "moderate"


@pytest.mark.asyncio
async def test_update_profile_cannot_mutate_weight(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "nomutate_weight@example.com")
    # Attempting to inject weight into profile update
    payload = {
        "first_name": "Marcus",
        "last_name": "Aurelius",
        "height_cm": "180.0",
        "activity_level": "active",
        "current_weight_kg": "85.0",
        "weight_kg": "85.0",
    }
    res = await client.put("/api/v1/profile", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    # Weight must strictly remain unchanged / None
    assert data["current_weight_kg"] is None


@pytest.mark.asyncio
async def test_update_profile_height_validation(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "height_val@example.com")
    res = await client.put(
        "/api/v1/profile",
        headers=headers,
        json={"first_name": "Valid", "height_cm": "40.0"},  # Below 50cm
    )
    assert res.status_code == 422

    res2 = await client.put(
        "/api/v1/profile",
        headers=headers,
        json={"first_name": "Valid", "height_cm": "350.0"},  # Above 300cm
    )
    assert res2.status_code == 422


@pytest.mark.asyncio
async def test_get_and_update_preferences(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "prefs@example.com")
    # 1. Get default preferences
    res = await client.get("/api/v1/profile/preferences", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["unit_system"] == "metric"
    assert data["dietary_restrictions"] == []

    # 2. Patch preferences
    patch_data = {
        "unit_system": "imperial",
        "calorie_target": 2400,
        "protein_target_g": "160.0",
        "dietary_restrictions": ["gluten_free", "dairy_free"],
        "ai_persona": "direct",
    }
    patch_res = await client.patch("/api/v1/profile/preferences", headers=headers, json=patch_data)
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert updated["unit_system"] == "imperial"
    assert updated["calorie_target"] == 2400
    assert float(updated["protein_target_g"]) == 160.0
    assert updated["dietary_restrictions"] == ["gluten_free", "dairy_free"]
    assert updated["ai_persona"] == "direct"
