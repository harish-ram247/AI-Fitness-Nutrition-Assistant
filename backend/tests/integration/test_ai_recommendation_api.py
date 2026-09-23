"""Phase 7D – Integration tests for AI-enriched recommendations API.

Uses real PostgreSQL database and FastAPI test client with MockLLMProvider overrides.

Coverage:
1. GET /api/v1/recommendations/meals?include_ai=true returns AI explanation
2. GET /api/v1/recommendations/workouts?include_ai=true returns AI explanation
3. Valid AI ranking applied
4. Invalid AI candidate triggers fallback to deterministic results
5. Mock LLM provider failure triggers fallback
6. Ownership isolation maintained with AI enabled (User B cannot see User A's custom items)
7. include_ai=false preserves exact deterministic behavior without calling LLM
8. Deterministic nutritional and workout numerical values remain strictly unchanged
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import AbstractLLMProvider
from app.ai.providers.mock import MockLLMProvider
from app.api.dependencies.ai import get_llm_provider
from app.api.dependencies.database import get_db
from app.main import app
from app.models.exercise import Exercise
from app.models.food import FoodItem, FoodItemServing
from app.recommendations.ai.models import (
    RecommendationAIOutput,
    RecommendationItemExplanation,
)


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
    food.servings = [serving]
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


def _make_catalog_exercise(
    name: str,
    category: str = "strength",
    muscle_groups: list[str] | None = None,
    equipment: str = "bodyweight",
    is_verified: bool = True,
    created_by_user_id: uuid.UUID | None = None,
) -> Exercise:
    return Exercise(
        id=uuid.uuid4(),
        name=name,
        category=category,
        muscle_groups=muscle_groups or ["chest"],
        equipment=equipment,
        is_verified=is_verified,
        created_by_user_id=created_by_user_id,
        deleted_at=None,
    )


async def _seed_catalog_exercises(db_session: AsyncSession) -> list[Exercise]:
    exercises = [
        # Push horizontal
        _make_catalog_exercise("Dumbbell Bench Press", "strength", ["chest"], "dumbbell"),
        _make_catalog_exercise("Push-Up", "strength", ["chest"], "bodyweight"),
        # Push vertical
        _make_catalog_exercise("Dumbbell Overhead Press", "strength", ["shoulders"], "dumbbell"),
        _make_catalog_exercise("Barbell Military Press", "strength", ["shoulders"], "barbell"),
        # Pull horizontal
        _make_catalog_exercise("Dumbbell Row", "strength", ["rhomboids"], "dumbbell"),
        _make_catalog_exercise("Inverted Row", "strength", ["back"], "bodyweight"),
        # Pull vertical
        _make_catalog_exercise("Pull-Up", "strength", ["lats"], "bodyweight"),
        _make_catalog_exercise("Lat Pulldown", "strength", ["lats"], "cable"),
        # Squat & Hinge
        _make_catalog_exercise("Goblet Squat", "strength", ["quadriceps"], "dumbbell"),
        _make_catalog_exercise("Romanian Deadlift", "strength", ["hamstrings"], "dumbbell"),
        # Core & Arm isolation
        _make_catalog_exercise("Plank", "strength", ["abdominals"], "bodyweight"),
        _make_catalog_exercise("Triceps Dip", "strength", ["triceps"], "bodyweight"),
        _make_catalog_exercise("Dumbbell Bicep Curl", "strength", ["biceps"], "dumbbell"),
        # Cardio & Mobility
        _make_catalog_exercise("Running", "cardio", ["quadriceps", "calves"], "bodyweight"),
        _make_catalog_exercise("Shoulder Stretch", "flexibility", ["shoulders"], "none"),
    ]
    for ex in exercises:
        db_session.add(ex)
    await db_session.commit()
    return exercises


# ─────────────────────────────────────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_meal_recommendations_include_ai_true_success(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /api/v1/recommendations/meals?include_ai=true enriches with AI explanation."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "meal_ai_success@example.com")

    # First get deterministic candidates to know candidate IDs
    det_resp = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=false",
        headers=headers,
    )
    assert det_resp.status_code == 200
    det_data = det_resp.json()
    cand_ids = [item["id"] for item in det_data["items"]]
    assert len(cand_ids) >= 1

    # Configure mock LLM with valid response
    ai_output = RecommendationAIOutput(
        selected_candidate_id=cand_ids[0],
        ranked_candidate_ids=list(reversed(cand_ids)),  # Valid permutation in reverse
        explanation="Custom tailored explanation for muscle preservation.",
        item_explanations=[
            RecommendationItemExplanation(
                candidate_id=cid, explanation=f"Rationale for {cid}"
            )
            for cid in cand_ids
        ],
        considerations=["Eat 1 hour before workout"],
    )
    mock_llm = MockLLMProvider(structured_response=ai_output)
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    resp = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=true",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Verify AI fields
    assert data["ai_used"] is True
    assert data["ai_fallback"] is False
    assert data["ai_summary"] == "Custom tailored explanation for muscle preservation."
    assert data["ai_considerations"] == ["Eat 1 hour before workout"]

    # Verify ranking reordered
    ranked_ids = [item["id"] for item in data["items"]]
    assert ranked_ids == list(reversed(cand_ids))
    assert data["items"][0]["ai_rank"] == 1
    assert data["items"][0]["ai_explanation"] == f"Rationale for {ranked_ids[0]}"


@pytest.mark.asyncio
async def test_workout_recommendations_include_ai_true_success(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """GET /api/v1/recommendations/workouts?include_ai=true enriches with AI coaching."""
    await _seed_catalog_exercises(db_session)
    headers = await _register_and_login(client, "workout_ai_success@example.com")

    # Get deterministic workout candidates
    det_resp = await client.get(
        "/api/v1/recommendations/workouts?workout_type=push&target_duration_minutes=30&include_ai=false",
        headers=headers,
    )
    assert det_resp.status_code == 200
    det_data = det_resp.json()
    cand_ids = [item["id"] for item in det_data["items"]]
    assert len(cand_ids) >= 1

    ai_output = RecommendationAIOutput(
        selected_candidate_id=cand_ids[0],
        ranked_candidate_ids=cand_ids,
        explanation="Focus on controlled tempo during presses.",
        item_explanations=[
            RecommendationItemExplanation(
                candidate_id=cand_ids[0], explanation="High stimulus workout"
            )
        ],
        considerations=["Warm up rotator cuff thoroughly"],
    )
    mock_llm = MockLLMProvider(structured_response=ai_output)
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    resp = await client.get(
        "/api/v1/recommendations/workouts?workout_type=push&target_duration_minutes=30&include_ai=true",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["ai_used"] is True
    assert data["ai_fallback"] is False
    assert data["ai_summary"] == "Focus on controlled tempo during presses."
    assert data["ai_considerations"] == ["Warm up rotator cuff thoroughly"]
    assert data["items"][0]["ai_explanation"] == "High stimulus workout"


@pytest.mark.asyncio
async def test_invalid_candidate_id_triggers_deterministic_fallback(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """If the LLM returns an unknown candidate ID, the API safely falls back to deterministic."""
    await _seed_catalog_exercises(db_session)
    headers = await _register_and_login(client, "ai_invalid_cand@example.com")

    det_resp = await client.get(
        "/api/v1/recommendations/workouts?workout_type=push&target_duration_minutes=30&include_ai=false",
        headers=headers,
    )
    det_data = det_resp.json()
    det_ids = [item["id"] for item in det_data["items"]]

    # Return an unauthorized invented ID
    ai_output = RecommendationAIOutput(
        selected_candidate_id="unauthorized_invented_id",
        ranked_candidate_ids=["unauthorized_invented_id"],
        explanation="Attempted hallucination",
    )
    mock_llm = MockLLMProvider(structured_response=ai_output)
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    resp = await client.get(
        "/api/v1/recommendations/workouts?workout_type=push&target_duration_minutes=30&include_ai=true",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    # Must fallback cleanly
    assert data["ai_used"] is False
    assert data["ai_fallback"] is True
    assert [item["id"] for item in data["items"]] == det_ids
    assert data["metadata"].get("ai_fallback_reason") is not None


@pytest.mark.asyncio
async def test_mock_llm_provider_failure_triggers_fallback(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """When the LLM provider fails, deterministic recommendations are returned

    with ai_fallback=True.
    """
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "ai_provider_fail@example.com")

    failing_llm = AsyncMock(spec=AbstractLLMProvider)
    failing_llm.structured_completion = AsyncMock(side_effect=RuntimeError("Connection timeout"))
    app.dependency_overrides[get_llm_provider] = lambda: failing_llm

    resp = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=true",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["ai_used"] is False
    assert data["ai_fallback"] is True
    assert len(data["items"]) > 0
    assert "Connection timeout" in data["metadata"]["ai_fallback_reason"]


@pytest.mark.asyncio
async def test_include_ai_false_does_not_invoke_llm(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """include_ai=false does not call the LLM and keeps AI metadata disabled."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "no_ai_invoked@example.com")

    mock_llm = MockLLMProvider()
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    resp = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=false",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["ai_used"] is False
    assert data["ai_fallback"] is False
    assert len(mock_llm.calls) == 0


@pytest.mark.asyncio
async def test_ownership_isolation_with_ai_enabled(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Custom exercise owned by User A must never appear in recommendations

    for User B with AI enabled.
    """
    await _seed_catalog_exercises(db_session)
    headers_a = await _register_and_login(client, "user_a_ai_iso@example.com")
    headers_b = await _register_and_login(client, "user_b_ai_iso@example.com")

    # User A creates a private custom exercise
    res_create = await client.post(
        "/api/v1/exercises",
        headers=headers_a,
        json={
            "name": "Secret User A Dumbbell Press",
            "category": "strength",
            "muscle_groups": ["chest"],
            "equipment": "dumbbell",
        },
    )
    assert res_create.status_code == 201
    user_a_exercise_id = res_create.json()["id"]

    # Configure mock LLM
    mock_llm = MockLLMProvider(
        structured_response=RecommendationAIOutput(
            explanation="Coaching explanation",
        )
    )
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    # User B requests recommendations with AI enabled
    resp_b = await client.get(
        "/api/v1/recommendations/workouts?include_ai=true",
        headers=headers_b,
    )
    assert resp_b.status_code == 200
    data_b = resp_b.json()

    # Assert User A's custom exercise is never included
    for item in data_b["items"]:
        for ex in item["exercises"]:
            assert ex["exercise_id"] != user_a_exercise_id
            assert ex["exercise_name"] != "Secret User A Dumbbell Press"


@pytest.mark.asyncio
async def test_deterministic_numerical_values_remain_unmodified(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Deterministic nutritional values are identical whether include_ai is False or True."""
    await _seed_catalog_foods(db_session)
    headers = await _register_and_login(client, "deterministic_integrity@example.com")

    # 1. include_ai=false
    resp_no_ai = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=false",
        headers=headers,
    )
    assert resp_no_ai.status_code == 200
    items_no_ai = resp_no_ai.json()["items"]

    # 2. include_ai=true
    cand_ids = [it["id"] for it in items_no_ai]
    mock_llm = MockLLMProvider(
        structured_response=RecommendationAIOutput(
            selected_candidate_id=cand_ids[0] if cand_ids else None,
            ranked_candidate_ids=cand_ids,
            explanation="Coaching explanation",
        )
    )
    app.dependency_overrides[get_llm_provider] = lambda: mock_llm

    resp_with_ai = await client.get(
        "/api/v1/recommendations/meals?target_calories=500&include_ai=true",
        headers=headers,
    )
    assert resp_with_ai.status_code == 200
    items_with_ai = resp_with_ai.json()["items"]

    assert len(items_no_ai) == len(items_with_ai)
    for no_ai_item, with_ai_item in zip(items_no_ai, items_with_ai, strict=True):
        assert no_ai_item["id"] == with_ai_item["id"]
        assert no_ai_item["total_calories"] == with_ai_item["total_calories"]
        assert no_ai_item["total_protein_g"] == with_ai_item["total_protein_g"]
        assert no_ai_item["total_carbs_g"] == with_ai_item["total_carbs_g"]
        assert no_ai_item["total_fat_g"] == with_ai_item["total_fat_g"]
        assert no_ai_item["score"] == with_ai_item["score"]
