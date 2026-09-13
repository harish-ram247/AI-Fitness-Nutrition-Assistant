import uuid
from decimal import Decimal
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
    client: AsyncClient, email: str = "nutrition_user@example.com"
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


async def seed_chicken_breast(db_session: AsyncSession) -> tuple[FoodItem, FoodItemServing]:
    food = FoodItem(
        id=uuid.uuid4(),
        name="Chicken Breast, cooked",
        calories_per_100g=Decimal("165.00"),
        protein_per_100g=Decimal("31.02"),
        carbs_per_100g=Decimal("0.00"),
        fat_per_100g=Decimal("3.57"),
        source="usda",
        usda_fdc_id=170889,
        usda_data_type="Foundation",
        usda_dataset_version="October 2024",
        is_verified=True,
    )
    serving = FoodItemServing(
        id=uuid.uuid4(),
        food_item_id=food.id,
        description="1 breast (174g)",
        grams=Decimal("174.00"),
        is_default=True,
    )
    food.servings.append(serving)
    db_session.add(food)
    await db_session.commit()
    return food, serving


@pytest.mark.asyncio
async def test_log_food_entry_modes_and_calculations(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, serving = await seed_chicken_breast(db_session)
    headers = await get_auth_headers(client, "logger1@example.com")

    # Mode A: Log directly via quantity_g (100g)
    entry_payload_a = {
        "food_item_id": str(food.id),
        "quantity_g": "100.0",
        "meal_type": "lunch",
        "logged_at": "2026-09-10T13:15:00Z",
    }
    res_a = await client.post(
        "/api/v1/nutrition/entries", headers=headers, json=entry_payload_a
    )
    assert res_a.status_code == 201
    data_a = res_a.json()
    assert float(data_a["calories"]) == 165.0
    assert float(data_a["protein_g"]) == 31.02
    assert float(data_a["carbs_g"]) == 0.0
    assert float(data_a["fat_g"]) == 3.57
    assert data_a["food_name_snapshot"] == "Chicken Breast, cooked"
    assert data_a["data_source_snapshot"] == "usda"
    assert data_a["usda_fdc_id_snapshot"] == 170889
    assert data_a["log_date"] == "2026-09-10"

    # Mode B: Log via serving_id + serving_count (1 breast = 174g)
    # 165 * 1.74 = 287.10 kcal; 31.02 * 1.74 = 53.97g protein; 3.57 * 1.74 = 6.21g fat
    entry_payload_b = {
        "food_item_id": str(food.id),
        "serving_id": str(serving.id),
        "serving_count": "1.0",
        "meal_type": "dinner",
        "logged_at": "2026-09-10T19:30:00Z",
    }
    res_b = await client.post(
        "/api/v1/nutrition/entries", headers=headers, json=entry_payload_b
    )
    assert res_b.status_code == 201
    data_b = res_b.json()
    assert float(data_b["quantity_g"]) == 174.0
    assert float(data_b["calories"]) == 287.10
    assert float(data_b["protein_g"]) == 53.97
    assert float(data_b["fat_g"]) == 6.21


@pytest.mark.asyncio
async def test_quantity_serving_validation_and_rejections(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, serving = await seed_chicken_breast(db_session)

    # Foreign food & serving
    foreign_food = FoodItem(
        id=uuid.uuid4(),
        name="Apple",
        calories_per_100g=Decimal("52.00"),
        protein_per_100g=Decimal("0.30"),
        carbs_per_100g=Decimal("14.00"),
        fat_per_100g=Decimal("0.20"),
        source="usda",
    )
    foreign_serving = FoodItemServing(
        id=uuid.uuid4(),
        food_item_id=foreign_food.id,
        description="1 medium",
        grams=Decimal("182.00"),
    )
    foreign_food.servings.append(foreign_serving)
    db_session.add(foreign_food)
    await db_session.commit()

    headers = await get_auth_headers(client, "val_user@example.com")

    # 1. Ambiguous: both quantity_g and serving_id provided -> 422
    ambiguous = {
        "food_item_id": str(food.id),
        "quantity_g": "100.0",
        "serving_id": str(serving.id),
        "serving_count": "1.0",
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_amb = await client.post("/api/v1/nutrition/entries", headers=headers, json=ambiguous)
    assert res_amb.status_code == 422

    # 2. Incomplete: neither provided -> 422
    neither = {
        "food_item_id": str(food.id),
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_neither = await client.post("/api/v1/nutrition/entries", headers=headers, json=neither)
    assert res_neither.status_code == 422

    # 3. Incomplete: serving_id without serving_count -> 422
    partial_srv = {
        "food_item_id": str(food.id),
        "serving_id": str(serving.id),
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_part = await client.post("/api/v1/nutrition/entries", headers=headers, json=partial_srv)
    assert res_part.status_code == 422

    # 4. Zero quantity -> 422
    zero_qty = {
        "food_item_id": str(food.id),
        "quantity_g": "0.0",
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_zero = await client.post("/api/v1/nutrition/entries", headers=headers, json=zero_qty)
    assert res_zero.status_code == 422

    # 5. Negative serving count -> 422
    neg_srv = {
        "food_item_id": str(food.id),
        "serving_id": str(serving.id),
        "serving_count": "-1.5",
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_neg = await client.post("/api/v1/nutrition/entries", headers=headers, json=neg_srv)
    assert res_neg.status_code == 422

    # 6. Foreign serving belonging to different food item -> 422
    mismatched_serving = {
        "food_item_id": str(food.id),
        "serving_id": str(foreign_serving.id),
        "serving_count": "1.0",
        "meal_type": "lunch",
        "logged_at": "2026-09-10T12:00:00Z",
    }
    res_mismatch = await client.post(
        "/api/v1/nutrition/entries", headers=headers, json=mismatched_serving
    )
    assert res_mismatch.status_code == 422
    assert "does not belong" in res_mismatch.json()["detail"]


@pytest.mark.asyncio
async def test_timezone_contract_and_boundary_crossing(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, _ = await seed_chicken_breast(db_session)
    headers = await get_auth_headers(client, "tz_user@example.com")

    # 1. Timezone-naive datetime -> MUST be rejected with 422
    naive_payload = {
        "food_item_id": str(food.id),
        "quantity_g": "100.0",
        "meal_type": "breakfast",
        "logged_at": "2026-09-10T08:30:00",  # No offset
    }
    res_naive = await client.post(
        "/api/v1/nutrition/entries", headers=headers, json=naive_payload
    )
    assert res_naive.status_code == 422

    # 2. Timezone-aware date boundary crossing
    # 2026-09-10 23:30 in EDT (-04:00) is 2026-09-11 03:30 in UTC
    boundary_payload = {
        "food_item_id": str(food.id),
        "quantity_g": "100.0",
        "meal_type": "snack",
        "logged_at": "2026-09-10T23:30:00-04:00",
    }
    res_boundary = await client.post(
        "/api/v1/nutrition/entries", headers=headers, json=boundary_payload
    )
    assert res_boundary.status_code == 201
    entry_boundary = res_boundary.json()
    # Normalized UTC date must be 2026-09-11
    assert entry_boundary["log_date"] == "2026-09-11"


@pytest.mark.asyncio
async def test_mandatory_historical_nutrition_snapshot_stability(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, _ = await seed_chicken_breast(db_session)
    headers = await get_auth_headers(client, "snapshot_tester@example.com")

    # 1. Log food entry (100g of Chicken: 165 kcal, 31.02g protein)
    log_res = await client.post(
        "/api/v1/nutrition/entries",
        headers=headers,
        json={
            "food_item_id": str(food.id),
            "quantity_g": "100.0",
            "meal_type": "lunch",
            "logged_at": "2026-09-10T12:00:00Z",
        },
    )
    assert log_res.status_code == 201
    entry_id = log_res.json()["id"]
    assert float(log_res.json()["calories"]) == 165.0
    assert float(log_res.json()["protein_g"]) == 31.02

    # 2. Directly alter the underlying FoodItem in PostgreSQL
    # (simulate USDA revised data / catalog update)
    food.calories_per_100g = Decimal("999.00")
    food.protein_per_100g = Decimal("99.00")
    food.name = "Mutated Chicken"
    await db_session.commit()

    # 3. Query daily summary
    summary_res = await client.get("/api/v1/nutrition/daily?date=2026-09-10", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()

    # CRITICAL INVARIANT: Totals and entries MUST retain the frozen historical snapshot!
    assert float(summary["totals"]["calories"]) == 165.0
    assert float(summary["totals"]["protein_g"]) == 31.02
    assert summary["meals"]["lunch"]["entries"][0]["food_name_snapshot"] == "Chicken Breast, cooked"
    assert summary["meals"]["lunch"]["entries"][0]["id"] == entry_id


@pytest.mark.asyncio
async def test_food_entry_patch_and_immutability(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, serving = await seed_chicken_breast(db_session)
    headers = await get_auth_headers(client, "patch_user@example.com")

    # Create entry (100g = 165 kcal)
    entry = (
        await client.post(
            "/api/v1/nutrition/entries",
            headers=headers,
            json={
                "food_item_id": str(food.id),
                "quantity_g": "100.0",
                "meal_type": "lunch",
                "logged_at": "2026-09-10T12:00:00Z",
            },
        )
    ).json()
    entry_id = entry["id"]

    # 1. PATCH with ONLY meal_type (quantity/serving omitted)
    # -> retains existing quantity and snapshot
    patch_meal = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"meal_type": "dinner"},
    )
    assert patch_meal.status_code == 200
    res_meal = patch_meal.json()
    assert res_meal["meal_type"] == "dinner"
    assert float(res_meal["quantity_g"]) == 100.0
    assert float(res_meal["calories"]) == 165.0
    assert float(res_meal["protein_g"]) == 31.02

    # 2. PATCH with ONLY logged_at (quantity/serving omitted)
    # -> recalculates log_date, retains quantity
    patch_time = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"logged_at": "2026-09-11T02:00:00Z"},
    )
    assert patch_time.status_code == 200
    res_time = patch_time.json()
    assert res_time["log_date"] == "2026-09-11"
    assert res_time["meal_type"] == "dinner"
    assert float(res_time["quantity_g"]) == 100.0

    # 3. PATCH with BOTH meal_type and logged_at (quantity/serving omitted) -> valid!
    patch_both_meta = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"meal_type": "breakfast", "logged_at": "2026-09-10T18:30:00+05:30"},
    )
    assert patch_both_meta.status_code == 200
    assert patch_both_meta.json()["meal_type"] == "breakfast"
    assert patch_both_meta.json()["log_date"] == "2026-09-10"

    # 4. PATCH quantity to 200g -> deterministically recalculate snapshot to 330 kcal
    patch_res = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"quantity_g": "200.0"},
    )
    assert patch_res.status_code == 200
    updated = patch_res.json()
    assert float(updated["quantity_g"]) == 200.0
    assert float(updated["calories"]) == 330.0
    assert float(updated["protein_g"]) == 62.04

    # 5. PATCH with serving mode -> 2 servings of 174g = 348g
    patch_srv = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"serving_id": str(serving.id), "serving_count": "2.0"},
    )
    assert patch_srv.status_code == 200
    res_srv = patch_srv.json()
    assert float(res_srv["quantity_g"]) == 348.0
    assert float(res_srv["calories"]) == 574.2

    # 6. Reject both modes supplied -> 422
    patch_both_modes = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={
            "quantity_g": "150.0",
            "serving_id": str(serving.id),
            "serving_count": "1.0",
        },
    )
    assert patch_both_modes.status_code == 422

    # 7. Reject incomplete serving mode -> 422
    patch_inc_srv = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"serving_id": str(serving.id)},
    )
    assert patch_inc_srv.status_code == 422

    patch_inc_cnt = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"serving_count": "1.0"},
    )
    assert patch_inc_cnt.status_code == 422

    # 8. Reject explicit nulls for quantity/serving and metadata fields -> 422
    assert (
        await client.patch(
            f"/api/v1/nutrition/entries/{entry_id}",
            headers=headers,
            json={"quantity_g": None},
        )
    ).status_code == 422

    assert (
        await client.patch(
            f"/api/v1/nutrition/entries/{entry_id}",
            headers=headers,
            json={"serving_id": None},
        )
    ).status_code == 422

    assert (
        await client.patch(
            f"/api/v1/nutrition/entries/{entry_id}",
            headers=headers,
            json={"serving_count": None},
        )
    ).status_code == 422

    assert (
        await client.patch(
            f"/api/v1/nutrition/entries/{entry_id}",
            headers=headers,
            json={"meal_type": None},
        )
    ).status_code == 422

    assert (
        await client.patch(
            f"/api/v1/nutrition/entries/{entry_id}",
            headers=headers,
            json={"logged_at": None},
        )
    ).status_code == 422

    # 9. Reject food_item_id (strictly immutable, not accepted by FoodEntryUpdate) -> 422
    fake_id = str(uuid.uuid4())
    patch_item = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers,
        json={"food_item_id": fake_id, "meal_type": "dinner"},
    )
    assert patch_item.status_code == 422


@pytest.mark.asyncio
async def test_food_entry_delete_and_cross_user_isolation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, _ = await seed_chicken_breast(db_session)
    headers_a = await get_auth_headers(client, "owner_a@example.com")
    headers_b = await get_auth_headers(client, "intruder_b@example.com")

    # User A creates entry
    entry_a = (
        await client.post(
            "/api/v1/nutrition/entries",
            headers=headers_a,
            json={
                "food_item_id": str(food.id),
                "quantity_g": "150.0",
                "meal_type": "breakfast",
                "logged_at": "2026-09-10T08:00:00Z",
            },
        )
    ).json()
    entry_id = entry_a["id"]

    # User B attempts to PATCH User A's entry -> 403 Forbidden
    patch_b = await client.patch(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers_b,
        json={"quantity_g": "50.0"},
    )
    assert patch_b.status_code == 403

    # User B attempts to DELETE User A's entry -> 403 Forbidden
    del_b = await client.delete(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers_b,
    )
    assert del_b.status_code == 403

    # User B's daily summary does NOT include User A's entries
    sum_b = await client.get("/api/v1/nutrition/daily?date=2026-09-10", headers=headers_b)
    assert float(sum_b.json()["totals"]["calories"]) == 0.0

    # User A deletes their entry -> 204 No Content
    del_a = await client.delete(
        f"/api/v1/nutrition/entries/{entry_id}",
        headers=headers_a,
    )
    assert del_a.status_code == 204

    # Subsequent daily summary for User A has 0 calories (deleted entry excluded)
    sum_a = await client.get("/api/v1/nutrition/daily?date=2026-09-10", headers=headers_a)
    assert float(sum_a.json()["totals"]["calories"]) == 0.0


@pytest.mark.asyncio
async def test_nutrition_history_range(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    food, _ = await seed_chicken_breast(db_session)
    headers = await get_auth_headers(client, "history_user@example.com")

    # Day 1: 100g (165 kcal)
    await client.post(
        "/api/v1/nutrition/entries",
        headers=headers,
        json={
            "food_item_id": str(food.id),
            "quantity_g": "100.0",
            "meal_type": "lunch",
            "logged_at": "2026-09-08T12:00:00Z",
        },
    )
    # Day 2: 200g (330 kcal)
    await client.post(
        "/api/v1/nutrition/entries",
        headers=headers,
        json={
            "food_item_id": str(food.id),
            "quantity_g": "200.0",
            "meal_type": "dinner",
            "logged_at": "2026-09-09T18:00:00Z",
        },
    )

    history_res = await client.get(
        "/api/v1/nutrition/history?from=2026-09-07&to=2026-09-10",
        headers=headers,
    )
    assert history_res.status_code == 200
    h_data = history_res.json()
    assert h_data["total_days"] == 2
    assert float(h_data["items"][0]["calories"]) == 165.0
    assert float(h_data["items"][1]["calories"]) == 330.0
