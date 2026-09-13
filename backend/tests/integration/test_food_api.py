import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app
from app.models.food import FoodItem, FoodItemServing


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
    client: AsyncClient, email: str = "food_user@example.com"
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
async def test_search_and_get_catalog_food(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # 1. Seed public USDA catalog food
    food = FoodItem(
        id=uuid.uuid4(),
        name="Oatmeal, rolled, cooked",
        category="Cereal Grains and Pasta",
        calories_per_100g=71.0,
        protein_per_100g=2.5,
        carbs_per_100g=12.0,
        fat_per_100g=1.5,
        source="usda",
        usda_fdc_id=1101534,
        is_verified=True,
    )
    food.servings.append(
        FoodItemServing(
            id=uuid.uuid4(),
            description="1 cup",
            grams=234.0,
            is_default=True,
        )
    )
    db_session.add(food)
    await db_session.commit()

    headers = await get_auth_headers(client, "searcher@example.com")

    # Search by name
    res = await client.get("/api/v1/foods?q=oatmeal", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Oatmeal, rolled, cooked"
    assert len(data["items"][0]["servings"]) == 1

    # Filter by category
    res_cat = await client.get(
        "/api/v1/foods?q=oatmeal&category=Cereal", headers=headers
    )
    assert res_cat.status_code == 200
    assert res_cat.json()["total"] == 1

    # Get by ID
    res_get = await client.get(f"/api/v1/foods/{food.id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == str(food.id)
    assert res_get.json()["is_verified"] is True


@pytest.mark.asyncio
async def test_custom_food_lifecycle_and_private_isolation(
    client: AsyncClient,
) -> None:
    headers_a = await get_auth_headers(client, "user_a@example.com")
    headers_b = await get_auth_headers(client, "user_b@example.com")

    # 1. User A creates custom food
    payload = {
        "name": "User A Special Smoothie",
        "category": "Beverages",
        "calories_per_100g": "85.0",
        "protein_per_100g": "10.5",
        "carbs_per_100g": "8.0",
        "fat_per_100g": "1.0",
        "servings": [
            {"description": "1 glass (300g)", "grams": "300.0", "is_default": True}
        ],
    }
    create_res = await client.post("/api/v1/foods", headers=headers_a, json=payload)
    assert create_res.status_code == 201
    food_a = create_res.json()
    food_id = food_a["id"]
    assert food_a["source"] == "user"
    assert food_a["is_verified"] is False
    assert len(food_a["servings"]) == 1

    # 2. User A can search and find their own custom food
    search_a = await client.get("/api/v1/foods?q=smoothie", headers=headers_a)
    assert search_a.status_code == 200
    assert search_a.json()["total"] == 1

    # 3. User B searches: MUST NOT see User A's custom food (private visibility)
    search_b = await client.get("/api/v1/foods?q=smoothie", headers=headers_b)
    assert search_b.status_code == 200
    assert search_b.json()["total"] == 0

    # 4. User B requests direct GET by ID: MUST return 404 (not visible)
    get_b = await client.get(f"/api/v1/foods/{food_id}", headers=headers_b)
    assert get_b.status_code == 404

    # 5. User B attempts to PATCH User A's food: MUST return 403 or 404
    patch_b = await client.patch(
        f"/api/v1/foods/{food_id}",
        headers=headers_b,
        json={"name": "Hacked Smoothie"},
    )
    assert patch_b.status_code in (403, 404)

    # 6. User A updates their custom food
    patch_a = await client.patch(
        f"/api/v1/foods/{food_id}",
        headers=headers_a,
        json={"name": "User A Updated Smoothie", "calories_per_100g": "90.0"},
    )
    assert patch_a.status_code == 200
    assert patch_a.json()["name"] == "User A Updated Smoothie"

    # 7. User A deletes their custom food
    del_a = await client.delete(f"/api/v1/foods/{food_id}", headers=headers_a)
    assert del_a.status_code == 204

    # Subsequent search by User A no longer finds the deleted food
    search_a2 = await client.get("/api/v1/foods?q=smoothie", headers=headers_a)
    assert search_a2.json()["total"] == 0


@pytest.mark.asyncio
async def test_catalog_food_protection_from_user_mutation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    # Seed public USDA food
    catalog_food = FoodItem(
        id=uuid.uuid4(),
        name="USDA Brown Rice",
        calories_per_100g=111.0,
        protein_per_100g=2.6,
        carbs_per_100g=23.0,
        fat_per_100g=0.9,
        source="usda",
        usda_fdc_id=1101535,
        created_by_user_id=None,
    )
    db_session.add(catalog_food)
    await db_session.commit()

    headers = await get_auth_headers(client, "malicious_user@example.com")

    # User attempts to PATCH catalog food -> 403 Forbidden
    patch_res = await client.patch(
        f"/api/v1/foods/{catalog_food.id}",
        headers=headers,
        json={"name": "Altered Rice"},
    )
    assert patch_res.status_code == 403
    assert "Cannot modify catalog food items" in patch_res.json()["detail"]

    # User attempts to DELETE catalog food -> 403 Forbidden
    del_res = await client.delete(
        f"/api/v1/foods/{catalog_food.id}",
        headers=headers,
    )
    assert del_res.status_code == 403
    assert "Cannot delete catalog food items" in del_res.json()["detail"]
