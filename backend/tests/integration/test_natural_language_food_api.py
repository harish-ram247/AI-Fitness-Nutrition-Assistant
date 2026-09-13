import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts.food_extraction import ExtractedFoodItem, ExtractedFoodList
from app.ai.providers.mock import MockLLMProvider
from app.api.dependencies.ai import get_llm_provider
from app.api.dependencies.database import get_db
from app.main import app
from app.models.food import FoodItem, FoodItemServing


@pytest.fixture
async def client(db_session: AsyncSession) -> Any:
    async def override_get_db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


async def get_auth_headers(
    client: AsyncClient, email: str = "nl_food_user@example.com"
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
async def test_natural_language_food_preview_and_unresolved(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "nl_preview_user@example.com")

    # Seed public food
    chicken = FoodItem(
        id=uuid.uuid4(),
        name="Chicken Breast, Grilled",
        calories_per_100g=Decimal("165.00"),
        protein_per_100g=Decimal("31.00"),
        carbs_per_100g=Decimal("0.00"),
        fat_per_100g=Decimal("3.60"),
        source="usda",
        created_by_user_id=None,
    )
    db_session.add(chicken)
    await db_session.commit()

    # Configure mock LLM to extract one recognized food and one non-existent food
    mock_extracted = ExtractedFoodList(
        items=[
            ExtractedFoodItem(
                extracted_text="200g of grilled chicken breast",
                food_name="Chicken Breast, Grilled",
                quantity=200.0,
                unit="g",
            ),
            ExtractedFoodItem(
                extracted_text="a glass of dragonfruit elixir",
                food_name="Dragonfruit Elixir Fantasia",
                quantity=1.0,
                unit="glass",
            ),
        ]
    )
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMProvider(
        structured_response=mock_extracted
    )

    now_iso = datetime.now(UTC).isoformat()
    res = await client.post(
        "/api/v1/nutrition/log-natural-language",
        headers=headers,
        json={
            "text": "I ate 200g of grilled chicken breast and a glass of dragonfruit elixir",
            "meal_type": "lunch",
            "logged_at": now_iso,
        },
    )
    assert res.status_code == 200
    preview = res.json()

    # Verify resolved item calculations (200g = 2 * base nutrients)
    assert len(preview["resolved_items"]) == 1
    resolved = preview["resolved_items"][0]
    assert resolved["food_item_id"] == str(chicken.id)
    assert float(resolved["quantity_g"]) == 200.0
    assert float(resolved["calories"]) == 330.0
    assert float(resolved["protein_g"]) == 62.0

    # Verify unresolved item
    assert len(preview["unresolved"]) == 1
    unresolved = preview["unresolved"][0]
    assert "Dragonfruit" in unresolved["recognized_name"]
    assert "search" in unresolved["suggested_action"].lower()

    app.dependency_overrides.pop(get_llm_provider, None)


@pytest.mark.asyncio
async def test_natural_language_confirm_server_recalculation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "nl_confirm_user@example.com")

    # Seed public food with serving
    oats = FoodItem(
        id=uuid.uuid4(),
        name="Rolled Oats",
        calories_per_100g=Decimal("389.00"),
        protein_per_100g=Decimal("16.90"),
        carbs_per_100g=Decimal("66.30"),
        fat_per_100g=Decimal("6.90"),
        source="usda",
        created_by_user_id=None,
    )
    oats_serving = FoodItemServing(
        id=uuid.uuid4(),
        food_item_id=oats.id,
        description="Cup of dry oats",
        grams=Decimal("80.00"),
        is_default=True,
    )
    oats.servings.append(oats_serving)
    db_session.add(oats)
    await db_session.commit()

    now_iso = datetime.now(UTC).isoformat()

    # Confirm with serving mode (2 cups = 160g)
    confirm_payload = {
        "confirmed_items": [
            {
                "food_item_id": str(oats.id),
                "serving_id": str(oats_serving.id),
                "serving_count": 2.0,
                "meal_type": "breakfast",
                "logged_at": now_iso,
            }
        ]
    }

    res = await client.post(
        "/api/v1/nutrition/log-natural-language/confirm",
        headers=headers,
        json=confirm_payload,
    )
    assert res.status_code == 201
    entries = res.json()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["meal_type"] == "breakfast"
    assert float(entry["quantity_g"]) == 160.0  # 80g * 2
    # 389 * 1.6 = 622.40
    assert float(entry["calories"]) == 622.4
    assert entry["entry_source"] == "natural_language"

    # Confirm daily summary reflects newly confirmed food entry
    today_date = datetime.now(UTC).date().isoformat()
    summary_res = await client.get(
        f"/api/v1/nutrition/daily?date={today_date}",
        headers=headers,
    )
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert float(summary["totals"]["calories"]) == 622.4


@pytest.mark.asyncio
async def test_natural_language_confirm_security_and_isolation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers_a = await get_auth_headers(client, "user_a@example.com")
    headers_b = await get_auth_headers(client, "user_b@example.com")

    # Create custom food by User B
    create_custom_res = await client.post(
        "/api/v1/foods",
        headers=headers_b,
        json={
            "name": "User B Secret Recipe Protein Shake",
            "calories_per_100g": 120.0,
            "protein_per_100g": 25.0,
            "carbs_per_100g": 5.0,
            "fat_per_100g": 2.0,
        },
    )
    assert create_custom_res.status_code == 201
    user_b_food_id = create_custom_res.json()["id"]

    now_iso = datetime.now(UTC).isoformat()

    # User A tries to confirm User B's custom food -> 404 Not Found
    res = await client.post(
        "/api/v1/nutrition/log-natural-language/confirm",
        headers=headers_a,
        json={
            "confirmed_items": [
                {
                    "food_item_id": user_b_food_id,
                    "quantity_g": 100.0,
                    "meal_type": "snack",
                    "logged_at": now_iso,
                }
            ]
        },
    )
    assert res.status_code == 404

    # User A tries to confirm non-existent food item -> 404 Not Found
    res_nonexistent = await client.post(
        "/api/v1/nutrition/log-natural-language/confirm",
        headers=headers_a,
        json={
            "confirmed_items": [
                {
                    "food_item_id": str(uuid.uuid4()),
                    "quantity_g": 100.0,
                    "meal_type": "snack",
                    "logged_at": now_iso,
                }
            ]
        },
    )
    assert res_nonexistent.status_code == 404
