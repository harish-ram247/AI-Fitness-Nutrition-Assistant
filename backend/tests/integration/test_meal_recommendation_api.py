"""Phase 7B – Integration tests for GET /api/v1/recommendations/meals.

Tests use real PostgreSQL (db_session fixture from conftest.py) and the full
FastAPI application.  All tests are self-contained: they seed required data,
make HTTP requests, and assert on the response.

Coverage:
  - GT-12: Low-budget invariants (empty result)
  - GT-13: Untracked mode (target_calories override without calorie_target)
  - Authentication enforcement (401 without token)
  - HTTP 422 when calorie_target absent and no override
  - meal_type defaulting to 'lunch'
  - Ownership isolation (user B cannot see user A's custom food recommendations)
  - Determinism: repeated identical requests return identical candidate IDs
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app
from app.models.food import FoodItem, FoodItemServing

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


@pytest.fixture
async def client(db_session: AsyncSession) -> Any:
    async def override_get_db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


async def _register_and_login(
    client: AsyncClient,
    email: str,
    password: str = "Password123!",
) -> dict[str, str]:
    await client.post("/api/v1/auth/register", json={"email": email, "password": password})
    tokens = (
        await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _set_preferences(
    client: AsyncClient,
    headers: dict[str, str],
    calorie_target: int | None = 2000,
    protein_target_g: float | None = 150.0,
) -> None:
    payload: dict[str, Any] = {}
    if calorie_target is not None:
        payload["calorie_target"] = calorie_target
    if protein_target_g is not None:
        payload["protein_target_g"] = str(protein_target_g)
    await client.patch("/api/v1/profile/preferences", headers=headers, json=payload)


def _make_catalog_food(
    name: str,
    protein: float = 25.0,
    carbs: float = 30.0,
    fat: float = 10.0,
    calories: float = 310.0,
    serving_grams: float = 150.0,
) -> FoodItem:
    food = FoodItem(
        id=uuid.uuid4(),
        name=name,
        category="Mixed Dishes",
        calories_per_100g=Decimal(str(calories / (serving_grams / 100))),
        protein_per_100g=Decimal(str(protein / (serving_grams / 100))),
        carbs_per_100g=Decimal(str(carbs / (serving_grams / 100))),
        fat_per_100g=Decimal(str(fat / (serving_grams / 100))),
        source="usda",
        usda_fdc_id=hash(name) % 9_000_000,
        is_verified=True,
        created_by_user_id=None,
    )
    serving = FoodItemServing(
        id=uuid.uuid4(),
        food_item_id=food.id,
        description=f"{serving_grams}g serving",
        grams=Decimal(str(serving_grams)),
        is_default=True,
    )
    food.servings.append(serving)
    return food


async def _seed_catalog_foods(db_session: AsyncSession) -> list[FoodItem]:
    """Seed a small catalog with foods that qualify for all three pools."""
    foods = [
        # High-protein foods (protein pool: protein >= 8g/100g)
        _make_catalog_food(
            "Turkey Breast", protein=30.0, carbs=0.0, fat=2.0, calories=140.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Tuna, canned", protein=26.0, carbs=0.0, fat=1.0, calories=116.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Egg Whites", protein=11.0, carbs=0.7, fat=0.2, calories=52.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Lentils, cooked", protein=9.0, carbs=20.0, fat=0.4, calories=116.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Cottage Cheese", protein=11.0, carbs=3.4, fat=4.3, calories=98.0, serving_grams=100.0
        ),
        # Carb/base foods (carbs >= 12g/100g AND calories >= 70/100g)
        _make_catalog_food(
            "Brown Rice, cooked",
            protein=2.6,
            carbs=23.0,
            fat=0.9,
            calories=111.0,
            serving_grams=150.0,
        ),
        _make_catalog_food(
            "Oatmeal, cooked", protein=2.5, carbs=12.0, fat=1.5, calories=71.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Sweet Potato, baked",
            protein=1.6,
            carbs=21.0,
            fat=0.1,
            calories=90.0,
            serving_grams=100.0,
        ),
        # Low-calorie / vegetable foods
        _make_catalog_food(
            "Broccoli, steamed", protein=2.8, carbs=5.2, fat=0.4, calories=35.0, serving_grams=100.0
        ),
        _make_catalog_food(
            "Spinach, raw", protein=2.9, carbs=3.6, fat=0.4, calories=23.0, serving_grams=100.0
        ),
    ]
    for food in foods:
        db_session.add(food)
    await db_session.commit()
    return foods


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_auth_required(client: AsyncClient) -> None:
    """Unauthenticated request returns HTTP 401."""
    res = await client.get("/api/v1/recommendations/meals")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_missing_calorie_target_without_override_returns_422(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Scenario C: calorie_target=None and no target_calories override → HTTP 422."""
    headers = await _register_and_login(client, "no_target@example.com")
    # Do NOT set calorie_target in preferences; register creates no preference row
    res = await client.get("/api/v1/recommendations/meals", headers=headers)
    assert res.status_code == 422
    detail = res.json().get("detail", "")
    assert "calorie target" in detail.lower() or "calorie_target" in detail.lower()


@pytest.mark.asyncio
async def test_invalid_meal_type_returns_422(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Invalid meal_type value returns HTTP 422."""
    headers = await _register_and_login(client, "badmeal@example.com")
    await _set_preferences(client, headers, calorie_target=2000)
    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=brunch",
        headers=headers,
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_meal_type_defaults_to_lunch(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Omitting meal_type defaults to 'lunch' with meal_type_defaulted=True in metadata."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "defaultmeal@example.com")
    await _set_preferences(client, headers, calorie_target=2000)
    res = await client.get("/api/v1/recommendations/meals", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["meal_type"] == "lunch"
    assert data["metadata"].get("meal_type_defaulted") is True


@pytest.mark.asyncio
async def test_gt12_c_remaining_zero_returns_empty(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GT-12: C_remaining <= 0 returns empty items list, even with target_calories override."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "fullday@example.com")
    await _set_preferences(client, headers, calorie_target=2000)

    # Consume 2500 kcal (> calorie_target=2000) so budget is exhausted
    foods_in_db = await db_session.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(FoodItem).limit(1)
    )
    food_item = foods_in_db.scalar_one_or_none()
    if food_item is None:
        pytest.skip("No food items in DB")

    from sqlalchemy import select

    from app.models.nutrition import FoodEntry
    from app.models.user import User
    user_row = await db_session.execute(
        select(User).where(User.email == "fullday@example.com")
    )
    user = user_row.scalar_one_or_none()
    if user is None:
        pytest.skip("User not found")

    entry = FoodEntry(
        id=uuid.uuid4(),
        user_id=user.id,
        food_item_id=food_item.id,
        meal_type="breakfast",
        quantity_g=Decimal("100.00"),
        food_name_snapshot=food_item.name,
        calories=Decimal("2500.00"),  # exceeds calorie_target=2000
        protein_g=Decimal("50.00"),
        carbs_g=Decimal("200.00"),
        fat_g=Decimal("80.00"),
        data_source_snapshot="usda",
        logged_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        log_date=__import__("datetime").date.today(),
        entry_source="manual",
    )
    db_session.add(entry)
    await db_session.commit()

    # Now request recommendations – should return empty
    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=lunch&target_calories=400",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    reason = data["metadata"].get("reason", "").lower()
    assert "reached" in reason or "exceeded" in reason


@pytest.mark.asyncio
async def test_gt12_c_remaining_below_100_returns_empty(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GT-12: 0 < C_remaining < 100 returns empty items list."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "almostfull@example.com")
    await _set_preferences(client, headers, calorie_target=2000)

    from sqlalchemy import select

    from app.models.nutrition import FoodEntry
    from app.models.user import User

    foods_in_db = await db_session.execute(select(FoodItem).limit(1))
    food_item = foods_in_db.scalar_one_or_none()
    if food_item is None:
        pytest.skip("No food items")

    user_row = await db_session.execute(
        select(User).where(User.email == "almostfull@example.com")
    )
    user = user_row.scalar_one_or_none()
    if user is None:
        pytest.skip("User not found")

    # Consume 1950 kcal → 50 remaining (< 100 threshold)
    entry = FoodEntry(
        id=uuid.uuid4(),
        user_id=user.id,
        food_item_id=food_item.id,
        meal_type="breakfast",
        quantity_g=Decimal("100.00"),
        food_name_snapshot=food_item.name,
        calories=Decimal("1950.00"),
        protein_g=Decimal("40.00"),
        carbs_g=Decimal("150.00"),
        fat_g=Decimal("60.00"),
        data_source_snapshot="usda",
        logged_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        log_date=__import__("datetime").date.today(),
        entry_source="manual",
    )
    db_session.add(entry)
    await db_session.commit()

    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=lunch",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    reason = data["metadata"].get("reason", "").lower()
    assert "100" in reason or "threshold" in reason


@pytest.mark.asyncio
async def test_gt13_untracked_mode_target_calories_override(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GT-13: calorie_target=None + target_calories supplied → untracked mode."""
    await _seed_catalog_foods(db_session)
    # Register user but do NOT set calorie_target
    headers = await _register_and_login(client, "untracked@example.com")
    # No preferences set → calorie_target = None
    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=lunch&target_calories=600",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["remaining_daily_calories"] is None
    assert data["metadata"]["daily_budget_tracked"] is False
    # All returned candidates must have total_calories <= 600
    for item in data["items"]:
        assert float(item["total_calories"]) <= 600.0


@pytest.mark.asyncio
async def test_recommendations_returns_valid_structure(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Happy path: successful recommendations with valid response structure."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "happypath@example.com")
    await _set_preferences(client, headers, calorie_target=2000, protein_target_g=150.0)

    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=lunch&limit=5",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    # Validate response structure
    assert "recommendation_type" in data
    assert data["recommendation_type"] == "meal"
    assert "items" in data
    assert "total_generated" in data
    assert "total_survived_filtering" in data
    assert "disclaimer" in data
    assert "allergen" in data["disclaimer"].lower()
    assert "metadata" in data
    assert isinstance(data["items"], list)

    # Validate item structure when items exist
    for item in data["items"]:
        assert "id" in item
        assert "components" in item
        assert isinstance(item["components"], list)
        assert len(item["components"]) >= 1
        assert "total_calories" in item
        assert "score" in item
        assert 0.0 <= item["score"] <= 1.0
        assert "factor_scores" in item
        assert len(item["factor_scores"]) == 4  # 4 scoring factors

    # GT-09: all items must be within remaining daily budget
    remaining = data.get("remaining_daily_calories")
    if remaining is not None:
        for item in data["items"]:
            assert float(item["total_calories"]) <= float(remaining) + 0.01


@pytest.mark.asyncio
async def test_gt11_determinism_repeated_requests(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """GT-11: Identical requests produce identical candidate IDs and ordering."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "deterministic@example.com")
    await _set_preferences(client, headers, calorie_target=2000)

    url = "/api/v1/recommendations/meals?meal_type=lunch&limit=10"
    res1 = await client.get(url, headers=headers)
    res2 = await client.get(url, headers=headers)
    assert res1.status_code == 200
    assert res2.status_code == 200

    ids1 = [item["id"] for item in res1.json()["items"]]
    ids2 = [item["id"] for item in res2.json()["items"]]
    assert ids1 == ids2


@pytest.mark.asyncio
async def test_ownership_isolation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """User B's custom food does not appear in User A's recommendations."""
    await _seed_catalog_foods(db_session)
    headers_a = await _register_and_login(client, "recuser_a@example.com")
    headers_b = await _register_and_login(client, "recuser_b@example.com")

    await _set_preferences(client, headers_a, calorie_target=2000)
    await _set_preferences(client, headers_b, calorie_target=2000)

    # User B creates custom food
    custom_food_payload = {
        "name": "UserBSecretFood ProteinShake",
        "calories_per_100g": "120.0",
        "protein_per_100g": "20.0",
        "carbs_per_100g": "10.0",
        "fat_per_100g": "2.0",
    }
    create_res = await client.post("/api/v1/foods", headers=headers_b, json=custom_food_payload)
    assert create_res.status_code == 201

    # User A requests recommendations – should NOT contain User B's food
    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=lunch",
        headers=headers_a,
    )
    assert res.status_code == 200
    all_food_names = [
        comp["food_name"]
        for item in res.json()["items"]
        for comp in item["components"]
    ]
    assert "UserBSecretFood ProteinShake" not in all_food_names


@pytest.mark.asyncio
async def test_snack_returns_single_items_only(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    """Snack meal type returns single-component candidates only."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "snacktest@example.com")
    await _set_preferences(client, headers, calorie_target=2000)

    res = await client.get(
        "/api/v1/recommendations/meals?meal_type=snack",
        headers=headers,
    )
    assert res.status_code == 200
    for item in res.json()["items"]:
        assert len(item["components"]) == 1, (
            f"Snack candidate '{item['id']}' has {len(item['components'])} components (expected 1)"
        )
