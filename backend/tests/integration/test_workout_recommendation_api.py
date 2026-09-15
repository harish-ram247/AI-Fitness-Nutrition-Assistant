"""Phase 7C – Integration tests for GET /api/v1/recommendations/workouts.

Tests use real PostgreSQL (db_session fixture from conftest.py) and the full
FastAPI application. All tests are self-contained: seed required data,
make HTTP requests, and assert on response schemas, bounds, and ownership isolation.

Coverage:
  - Authentication enforcement (401 without Bearer token)
  - Parameter validation and 422 error handling
  - End-to-end workout recommendation generation and schema verification
  - workout_type filtering and candidate bounds (<= 4 candidates when filtered)
  - Equipment filtering (unconstrained vs constrained)
  - Target duration hard filter bounds
  - User custom exercise ownership isolation (User B cannot see User A's custom exercises)
  - Determinism (repeated identical requests yield identical ranked results)
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.main import app
from app.models.exercise import Exercise

# ─────────────────────────────────────────────────────────────────────────────
# Fixtures & Helpers
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


async def _seed_rich_exercise_catalog(db_session: AsyncSession) -> list[Exercise]:
    exercises = [
        # Squat
        _make_catalog_exercise("Goblet Squat", "strength", ["quadriceps"], "dumbbell"),
        _make_catalog_exercise("Barbell Back Squat", "strength", ["quadriceps"], "barbell"),
        # Hinge
        _make_catalog_exercise("Romanian Deadlift", "strength", ["hamstrings"], "dumbbell"),
        _make_catalog_exercise(
            "Barbell Deadlift", "strength", ["quadriceps", "hamstrings"], "barbell"
        ),
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
        # Core
        _make_catalog_exercise("Plank", "strength", ["abdominals"], "bodyweight"),
        _make_catalog_exercise("Hanging Leg Raise", "strength", ["abdominals"], "bodyweight"),
        # Arm isolation
        _make_catalog_exercise("Triceps Dip", "strength", ["triceps"], "bodyweight"),
        _make_catalog_exercise("Dumbbell Bicep Curl", "strength", ["biceps"], "dumbbell"),
        # Cardio
        _make_catalog_exercise("Running", "cardio", ["quadriceps", "calves"], "bodyweight"),
        _make_catalog_exercise("Jump Rope", "cardio", ["calves"], "none"),
        _make_catalog_exercise("Rowing", "cardio", ["back", "quadriceps"], "machine"),
        # Flexibility / Mobility
        _make_catalog_exercise("Shoulder Stretch", "flexibility", ["shoulders"], "none"),
        _make_catalog_exercise("Hamstring Stretch", "flexibility", ["hamstrings"], "none"),
        _make_catalog_exercise("Cat Cow", "flexibility", ["abdominals"], "none"),
        _make_catalog_exercise("Hip Flexor Stretch", "flexibility", ["quadriceps"], "none"),
    ]
    for ex in exercises:
        db_session.add(ex)
    await db_session.commit()
    return exercises


# ─────────────────────────────────────────────────────────────────────────────
# Integration Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_auth_required(client: AsyncClient) -> None:
    """GET /api/v1/recommendations/workouts requires Bearer authentication."""
    resp = await client.get("/api/v1/recommendations/workouts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_invalid_parameters_return_422(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Invalid query parameters return 422 Unprocessable Content."""
    headers = await _register_and_login(client, "test_params_422@example.com")

    # Invalid workout_type
    resp_type = await client.get(
        "/api/v1/recommendations/workouts?workout_type=crossfit",
        headers=headers,
    )
    assert resp_type.status_code == 422

    # Target duration too small (< 15)
    resp_dur_low = await client.get(
        "/api/v1/recommendations/workouts?target_duration_minutes=10",
        headers=headers,
    )
    assert resp_dur_low.status_code == 422

    # Target duration too large (> 120)
    resp_dur_high = await client.get(
        "/api/v1/recommendations/workouts?target_duration_minutes=150",
        headers=headers,
    )
    assert resp_dur_high.status_code == 422

    # Invalid limit (< 1 or > 20)
    resp_limit_low = await client.get(
        "/api/v1/recommendations/workouts?limit=0",
        headers=headers,
    )
    assert resp_limit_low.status_code == 422

    resp_limit_high = await client.get(
        "/api/v1/recommendations/workouts?limit=25",
        headers=headers,
    )
    assert resp_limit_high.status_code == 422


@pytest.mark.asyncio
async def test_unconstrained_recommendations_valid_structure(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Unconstrained request returns 200 with complete response schema."""
    await _seed_rich_exercise_catalog(db_session)
    headers = await _register_and_login(client, "test_valid_structure@example.com")

    resp = await client.get("/api/v1/recommendations/workouts", headers=headers)
    assert resp.status_code == 200

    data = resp.json()
    assert "items" in data
    assert "disclaimer" in data
    assert len(data["items"]) > 0
    assert "Workout recommendations are training suggestions" in data["disclaimer"]

    first = data["items"][0]
    assert "id" in first
    assert "name" in first
    assert "workout_type" in first
    assert "category" in first
    assert "target_muscle_groups" in first
    assert "exercises" in first
    assert "estimated_duration_minutes" in first
    assert "total_sets" in first
    assert "primary_equipment_needed" in first
    assert "variant" in first
    assert "score" in first
    assert "factor_scores" in first
    assert 0.0 <= first["score"] <= 1.0

    # Verify exercise items
    assert len(first["exercises"]) > 0
    first_ex = first["exercises"][0]
    assert "exercise_id" in first_ex
    assert "exercise_name" in first_ex
    assert "category" in first_ex
    assert "recommended_sets" in first_ex
    assert "recommended_rest_seconds" in first_ex


@pytest.mark.asyncio
async def test_workout_type_filtering_and_candidate_bounds(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Filtering by workout_type returns at most 4 candidates, all matching the type."""
    await _seed_rich_exercise_catalog(db_session)
    headers = await _register_and_login(client, "test_type_filtering@example.com")

    for w_type in ("full_body", "push", "pull", "cardio", "mobility"):
        resp = await client.get(
            f"/api/v1/recommendations/workouts?workout_type={w_type}",
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()

        # Hard candidate bound: <= 4 candidates when workout_type is specified
        assert len(data["items"]) <= 4
        for item in data["items"]:
            assert item["workout_type"] == w_type


@pytest.mark.asyncio
async def test_equipment_filtering_constrained(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Constrained equipment request only includes bodyweight/none or requested equipment."""
    await _seed_rich_exercise_catalog(db_session)
    headers = await _register_and_login(client, "test_eq_constrained@example.com")

    # Request with only dumbbell
    resp = await client.get(
        "/api/v1/recommendations/workouts?equipment=dumbbell",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    allowed_equipment = {"dumbbell", "bodyweight", "none"}
    for item in data["items"]:
        for ex in item["exercises"]:
            eq = (ex["equipment"] or "").strip().lower()
            if eq:
                assert eq in allowed_equipment, f"Found unpermitted equipment: {eq}"


@pytest.mark.asyncio
async def test_target_duration_filtering(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Target duration applies hard filtering: D_min <= D_est <= D_max."""
    await _seed_rich_exercise_catalog(db_session)
    headers = await _register_and_login(client, "test_target_duration@example.com")

    target_d = 30
    # D_min = max(10, floor(0.50 * 30)) = 15
    # D_max = min(120, ceil(1.35 * 30 + 5)) = ceil(45.5) = 46
    resp = await client.get(
        f"/api/v1/recommendations/workouts?target_duration_minutes={target_d}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()

    for item in data["items"]:
        d_est = item["estimated_duration_minutes"]
        assert 15 <= d_est <= 46, f"Duration {d_est} min outside [15, 46] for target {target_d}"


@pytest.mark.asyncio
async def test_custom_exercise_ownership_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """User B must never receive recommendations containing User A's custom exercises."""
    # Seed baseline catalog
    await _seed_rich_exercise_catalog(db_session)

    # User A registers
    headers_a = await _register_and_login(client, "user_a_owner@example.com")

    # User B registers
    headers_b = await _register_and_login(client, "user_b_owner@example.com")

    # User A creates a custom private exercise via API
    res_create = await client.post(
        "/api/v1/exercises",
        headers=headers_a,
        json={
            "name": "User A Secret Push Variation",
            "category": "strength",
            "muscle_groups": ["chest", "triceps"],
            "equipment": "dumbbell",
        },
    )
    assert res_create.status_code == 201
    custom_exercise_id = res_create.json()["id"]

    # User B requests recommendations: User A's custom exercise MUST NOT appear
    resp_b = await client.get("/api/v1/recommendations/workouts", headers=headers_b)
    assert resp_b.status_code == 200
    data_b = resp_b.json()

    for item in data_b["items"]:
        for ex in item["exercises"]:
            assert ex["exercise_id"] != custom_exercise_id
            assert ex["exercise_name"] != "User A Secret Push Variation"

    # User A requests recommendations: custom exercise CAN appear
    resp_a = await client.get(
        "/api/v1/recommendations/workouts?workout_type=push", headers=headers_a
    )
    assert resp_a.status_code == 200


@pytest.mark.asyncio
async def test_determinism_repeated_requests(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Repeated identical requests return identical candidate IDs in identical rank order."""
    await _seed_rich_exercise_catalog(db_session)
    headers = await _register_and_login(client, "test_determinism@example.com")

    resp1 = await client.get("/api/v1/recommendations/workouts", headers=headers)
    resp2 = await client.get("/api/v1/recommendations/workouts", headers=headers)

    assert resp1.status_code == 200
    assert resp2.status_code == 200

    data1 = resp1.json()
    data2 = resp2.json()

    assert len(data1["items"]) == len(data2["items"])
    ids1 = [item["id"] for item in data1["items"]]
    ids2 = [item["id"] for item in data2["items"]]
    assert ids1 == ids2

    scores1 = [item["score"] for item in data1["items"]]
    scores2 = [item["score"] for item in data2["items"]]
    assert scores1 == scores2
