import uuid
from decimal import Decimal
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
    client: AsyncClient, email: str = "workout_user@example.com"
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


async def seed_test_exercises(db_session: AsyncSession) -> tuple[Exercise, Exercise]:
    ex1 = Exercise(
        id=uuid.uuid4(),
        name="Bench Press",
        category="strength",
        muscle_groups=["chest"],
        is_verified=True,
        created_by_user_id=None,
    )
    ex2 = Exercise(
        id=uuid.uuid4(),
        name="Squat",
        category="strength",
        muscle_groups=["quadriceps"],
        is_verified=True,
        created_by_user_id=None,
    )
    db_session.add_all([ex1, ex2])
    await db_session.commit()
    return ex1, ex2


@pytest.mark.asyncio
async def test_standalone_session_and_duration_contract(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_duration@example.com")

    # 1. Attempt to supply duration_minutes in create -> 422 Unprocessable Entity
    bad_payload = {
        "name": "Leg Day",
        "started_at": "2026-09-12T10:00:00+00:00",
        "ended_at": "2026-09-12T11:00:00+00:00",
        "duration_minutes": 60,
    }
    res = await client.post("/api/v1/workouts", json=bad_payload, headers=headers)
    assert res.status_code == 422

    # 2. Reject timezone-naive timestamps
    naive_payload = {
        "name": "Leg Day",
        "started_at": "2026-09-12T10:00:00",
    }
    res = await client.post("/api/v1/workouts", json=naive_payload, headers=headers)
    assert res.status_code == 422

    # 3. Reject ended_at < started_at
    inverted_payload = {
        "name": "Time Traveler",
        "started_at": "2026-09-12T10:00:00+00:00",
        "ended_at": "2026-09-12T09:00:00+00:00",
    }
    res = await client.post("/api/v1/workouts", json=inverted_payload, headers=headers)
    assert res.status_code == 422

    # 4. Create session without ended_at -> duration_minutes is None
    payload_open = {
        "name": "Morning Push",
        "started_at": "2026-09-12T10:00:00+00:00",
        "tags": ["chest", "push"],
    }
    res = await client.post("/api/v1/workouts", json=payload_open, headers=headers)
    assert res.status_code == 201
    created_open = res.json()
    assert created_open["duration_minutes"] is None
    session_id = created_open["id"]

    # 5. Attempt to supply duration_minutes in update -> 422
    res = await client.patch(
        f"/api/v1/workouts/{session_id}",
        json={"duration_minutes": 45},
        headers=headers,
    )
    assert res.status_code == 422

    # 6. Update ended_at -> duration_minutes is derived and recalculated
    # 10:00:00 to 10:45:30 = 2730 seconds = 45.5 minutes -> round() = 46 minutes
    res = await client.patch(
        f"/api/v1/workouts/{session_id}",
        json={"ended_at": "2026-09-12T10:45:30+00:00"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["duration_minutes"] == 46

    # 7. Update started_at -> duration_minutes recalculated again
    # 10:15:00 to 10:45:30 = 1830 seconds = 30.5 -> round() = 30 (even rounding or 30)
    res = await client.patch(
        f"/api/v1/workouts/{session_id}",
        json={"started_at": "2026-09-12T10:15:00+00:00"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["duration_minutes"] == 31 or res.json()["duration_minutes"] == 30


@pytest.mark.asyncio
async def test_nested_workout_creation_and_ordering(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_nested@example.com")
    ex1, ex2 = await seed_test_exercises(db_session)

    payload = {
        "name": "Full Body A",
        "started_at": "2026-09-12T08:00:00+00:00",
        "ended_at": "2026-09-12T09:15:00+00:00",
        "tags": ["strength", "fullbody"],
        "exercises": [
            {
                "exercise_id": str(ex2.id),
                "order_index": 1,
                "notes": "Squat heavy",
                "sets": [
                    {
                        "set_number": 2,
                        "set_type": "working",
                        "weight_kg": "100.00",
                        "reps": 5,
                        "rpe": "8.5",
                        "completed": True,
                    },
                    {
                        "set_number": 1,
                        "set_type": "warmup",
                        "weight_kg": "60.00",
                        "reps": 10,
                        "rpe": "6.0",
                        "completed": True,
                    },
                ],
            },
            {
                "exercise_id": str(ex1.id),
                "order_index": 0,
                "notes": "Bench first",
                "sets": [
                    {
                        "set_number": 1,
                        "set_type": "working",
                        "weight_kg": "80.00",
                        "reps": 8,
                        "rpe": "7.5",
                        "completed": True,
                    }
                ],
            },
        ],
    }

    res = await client.post("/api/v1/workouts", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["duration_minutes"] == 75
    assert len(data["exercises"]) == 2

    # Exercises must be ordered by order_index ASC (order_index 0: Bench, order_index 1: Squat)
    assert data["exercises"][0]["order_index"] == 0
    assert data["exercises"][0]["exercise"]["name"] == "Bench Press"
    assert data["exercises"][1]["order_index"] == 1
    assert data["exercises"][1]["exercise"]["name"] == "Squat"

    # Sets in Squat must be ordered by set_number ASC (set 1 first, then set 2)
    squat_sets = data["exercises"][1]["sets"]
    assert len(squat_sets) == 2
    assert squat_sets[0]["set_number"] == 1
    assert squat_sets[0]["set_type"] == "warmup"
    assert squat_sets[1]["set_number"] == 2
    assert squat_sets[1]["set_type"] == "working"


@pytest.mark.asyncio
async def test_duplicate_set_number_conflicts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_conflict@example.com")
    ex1, ex2 = await seed_test_exercises(db_session)

    # 1. Duplicate set_number in nested payload -> 409 Conflict
    bad_nested = {
        "name": "Chest Day",
        "started_at": "2026-09-12T08:00:00+00:00",
        "exercises": [
            {
                "exercise_id": str(ex1.id),
                "order_index": 0,
                "sets": [
                    {"set_number": 1, "reps": 10},
                    {"set_number": 1, "reps": 8},  # Duplicate!
                ],
            }
        ],
    }
    res = await client.post("/api/v1/workouts", json=bad_nested, headers=headers)
    assert res.status_code == 409
    assert "Duplicate set_number 1" in res.json()["detail"]

    # 2. Create valid session with one exercise and one set
    valid_payload = {
        "name": "Chest Day",
        "started_at": "2026-09-12T08:00:00+00:00",
        "exercises": [
            {
                "exercise_id": str(ex1.id),
                "order_index": 0,
                "sets": [{"set_number": 1, "reps": 10}],
            }
        ],
    }
    res = await client.post("/api/v1/workouts", json=valid_payload, headers=headers)
    assert res.status_code == 201
    workout_id = res.json()["id"]
    we_id = res.json()["exercises"][0]["id"]
    set1_id = res.json()["exercises"][0]["sets"][0]["id"]

    # 3. Adding set with duplicate set_number 1 -> 409 Conflict
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "reps": 8},
        headers=headers,
    )
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]

    # 4. Adding set with set_number 2 -> succeeds
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 2, "reps": 8},
        headers=headers,
    )
    assert res.status_code == 201
    set2_id = res.json()["id"]

    # 5. Updating set 2 to set_number 1 -> 409 Conflict
    res = await client.patch(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets/{set2_id}",
        json={"set_number": 1},
        headers=headers,
    )
    assert res.status_code == 409

    # 6. Same set_number 1 in a different exercise -> allowed
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises",
        json={"exercise_id": str(ex2.id), "order_index": 1, "sets": [{"set_number": 1, "reps": 5}]},
        headers=headers,
    )
    assert res.status_code == 201

    # 7. Deleting set 1 does not renumber set 2
    res = await client.delete(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets/{set1_id}",
        headers=headers,
    )
    assert res.status_code == 204

    # Verify set 2 remains with set_number 2
    res = await client.get(f"/api/v1/workouts/{workout_id}", headers=headers)
    assert res.status_code == 200
    sets = res.json()["exercises"][0]["sets"]
    assert len(sets) == 1
    assert sets[0]["set_number"] == 2


@pytest.mark.asyncio
async def test_numeric_and_rpe_validations(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_numeric@example.com")
    ex1, _ = await seed_test_exercises(db_session)

    res = await client.post(
        "/api/v1/workouts",
        json={"name": "Test", "started_at": "2026-09-12T10:00:00+00:00"},
        headers=headers,
    )
    workout_id = res.json()["id"]

    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises",
        json={"exercise_id": str(ex1.id)},
        headers=headers,
    )
    we_id = res.json()["id"]

    # set_number < 1 -> 422
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 0},
        headers=headers,
    )
    assert res.status_code == 422

    # Negative reps -> 422
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "reps": -5},
        headers=headers,
    )
    assert res.status_code == 422

    # Negative weight -> 422
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "weight_kg": "-10.00"},
        headers=headers,
    )
    assert res.status_code == 422

    # RPE < 1.0 -> 422
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "rpe": "0.5"},
        headers=headers,
    )
    assert res.status_code == 422

    # RPE > 10.0 -> 422
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "rpe": "10.5"},
        headers=headers,
    )
    assert res.status_code == 422

    # RPE non-0.5 increment -> 422 (e.g. 7.3)
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "rpe": "7.3"},
        headers=headers,
    )
    assert res.status_code == 422

    # Valid RPE 7.5 -> 201
    res = await client.post(
        f"/api/v1/workouts/{workout_id}/exercises/{we_id}/sets",
        json={"set_number": 1, "rpe": "7.5", "completed": True},
        headers=headers,
    )
    assert res.status_code == 201
    assert Decimal(res.json()["rpe"]) == Decimal("7.5")


@pytest.mark.asyncio
async def test_workout_ownership_and_hierarchical_isolation(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers_user1 = await get_auth_headers(client, "user_iso1@example.com")
    headers_user2 = await get_auth_headers(client, "user_iso2@example.com")
    ex1, _ = await seed_test_exercises(db_session)

    # User 1 creates workout
    res = await client.post(
        "/api/v1/workouts",
        json={
            "name": "User 1 Workout",
            "started_at": "2026-09-12T12:00:00+00:00",
            "exercises": [
                {
                    "exercise_id": str(ex1.id),
                    "order_index": 0,
                    "sets": [{"set_number": 1, "reps": 10}],
                }
            ],
        },
        headers=headers_user1,
    )
    assert res.status_code == 201
    w1_id = res.json()["id"]
    we1_id = res.json()["exercises"][0]["id"]
    set1_id = res.json()["exercises"][0]["sets"][0]["id"]

    # User 2 attempts to GET User 1's workout -> 404
    res = await client.get(f"/api/v1/workouts/{w1_id}", headers=headers_user2)
    assert res.status_code == 404

    # User 2 attempts to PATCH User 1's workout -> 404
    res = await client.patch(
        f"/api/v1/workouts/{w1_id}",
        json={"name": "Hacked Name"},
        headers=headers_user2,
    )
    assert res.status_code == 404

    # User 2 attempts to DELETE User 1's workout -> 404
    res = await client.delete(f"/api/v1/workouts/{w1_id}", headers=headers_user2)
    assert res.status_code == 404

    # User 2 attempts to add exercise to User 1's workout -> 404
    res = await client.post(
        f"/api/v1/workouts/{w1_id}/exercises",
        json={"exercise_id": str(ex1.id)},
        headers=headers_user2,
    )
    assert res.status_code == 404

    # User 2 attempts to add set to User 1's exercise -> 404
    res = await client.post(
        f"/api/v1/workouts/{w1_id}/exercises/{we1_id}/sets",
        json={"set_number": 2, "reps": 10},
        headers=headers_user2,
    )
    assert res.status_code == 404

    # User 2 attempts to update set in User 1's exercise -> 404
    res = await client.patch(
        f"/api/v1/workouts/{w1_id}/exercises/{we1_id}/sets/{set1_id}",
        json={"reps": 12},
        headers=headers_user2,
    )
    assert res.status_code == 404

    # User 2 attempts to delete set in User 1's exercise -> 404
    res = await client.delete(
        f"/api/v1/workouts/{w1_id}/exercises/{we1_id}/sets/{set1_id}",
        headers=headers_user2,
    )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cannot_attach_other_user_custom_exercise(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers_user1 = await get_auth_headers(client, "custom_owner@example.com")
    headers_user2 = await get_auth_headers(client, "other_user@example.com")

    # User 1 creates custom exercise
    res = await client.post(
        "/api/v1/exercises",
        json={"name": "Secret User1 Lift", "category": "strength", "muscle_groups": ["back"]},
        headers=headers_user1,
    )
    assert res.status_code == 201
    custom_ex_id = res.json()["id"]

    # User 2 creates a workout
    res = await client.post(
        "/api/v1/workouts",
        json={"name": "User 2 Workout", "started_at": "2026-09-12T14:00:00+00:00"},
        headers=headers_user2,
    )
    assert res.status_code == 201
    w2_id = res.json()["id"]

    # User 2 attempts to attach User 1's custom exercise -> 404 Not Found
    res = await client.post(
        f"/api/v1/workouts/{w2_id}/exercises",
        json={"exercise_id": custom_ex_id},
        headers=headers_user2,
    )
    assert res.status_code == 404
    assert "not found or not visible" in res.json()["detail"]


@pytest.mark.asyncio
async def test_workout_soft_delete_and_history(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_softdel@example.com")

    res = await client.post(
        "/api/v1/workouts",
        json={
            "name": "Session to delete",
            "started_at": "2026-09-12T15:00:00+00:00",
            "ended_at": "2026-09-12T16:00:00+00:00",
        },
        headers=headers,
    )
    w_id = res.json()["id"]

    # Active query returns session
    res = await client.get("/api/v1/workouts", headers=headers)
    assert res.status_code == 200
    assert any(item["id"] == w_id for item in res.json()["items"])

    # Soft delete
    res = await client.delete(f"/api/v1/workouts/{w_id}", headers=headers)
    assert res.status_code == 204

    # Single GET returns 404
    res = await client.get(f"/api/v1/workouts/{w_id}", headers=headers)
    assert res.status_code == 404

    # List query excludes it
    res = await client.get("/api/v1/workouts", headers=headers)
    assert res.status_code == 200
    assert not any(item["id"] == w_id for item in res.json()["items"])


@pytest.mark.asyncio
async def test_workout_date_filtering(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    headers = await get_auth_headers(client, "user_datefilter@example.com")

    # Create 3 workouts on different dates
    for d in ["2026-09-01", "2026-09-05", "2026-09-10"]:
        res = await client.post(
            "/api/v1/workouts",
            json={
                "name": f"Workout on {d}",
                "started_at": f"{d}T10:00:00+00:00",
                "ended_at": f"{d}T11:00:00+00:00",
            },
            headers=headers,
        )
        assert res.status_code == 201

    # Filter from 2026-09-04 to 2026-09-08 -> should return only 2026-09-05
    res = await client.get(
        "/api/v1/workouts?from_date=2026-09-04T00:00:00Z&to_date=2026-09-08T23:59:59Z",
        headers=headers,
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["name"] == "Workout on 2026-09-05"
