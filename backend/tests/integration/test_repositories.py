from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.food import FoodItem, FoodItemServing
from app.models.nutrition import FoodEntry
from app.models.progress import WeightEntry
from app.models.user import User, UserProfile
from app.repositories.food_repository import FoodRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.weight_repository import WeightRepository


@pytest.mark.asyncio
async def test_user_repository(db_session: AsyncSession) -> None:
    repo = UserRepository(db_session)

    # Create user
    user = User(
        email="athlete_repo@example.com",
        hashed_password="secure_password",
        is_active=True,
    )
    created_user = await repo.create(user)
    assert created_user.id is not None

    # Get by id
    found_user = await repo.get_by_id(created_user.id)
    assert found_user is not None
    assert found_user.email == "athlete_repo@example.com"

    # Get by email (case-insensitive)
    found_by_email = await repo.get_by_email("ATHLETE_REPO@EXAMPLE.COM")
    assert found_by_email is not None
    assert found_by_email.id == created_user.id

    # Create profile
    profile = UserProfile(
        user_id=created_user.id,
        first_name="Sam",
        current_weight_kg=Decimal("70.00"),
    )
    created_profile = await repo.create_profile(profile)
    assert created_profile.id is not None

    # Get profile
    found_profile = await repo.get_profile(created_user.id)
    assert found_profile is not None
    assert found_profile.first_name == "Sam"
    assert found_profile.current_weight_kg == Decimal("70.00")


@pytest.mark.asyncio
async def test_food_repository(db_session: AsyncSession) -> None:
    repo = FoodRepository(db_session)

    food = FoodItem(
        name="Greek Yogurt Plain",
        brand="Chobani",
        calories_per_100g=Decimal("59.00"),
        protein_per_100g=Decimal("10.00"),
        carbs_per_100g=Decimal("3.60"),
        fat_per_100g=Decimal("0.40"),
        source="usda",
        usda_fdc_id=2341234,
        usda_data_type="branded",
        usda_dataset_version="2024-10",
        is_verified=True,
    )
    serving = FoodItemServing(
        description="1 cup",
        grams=Decimal("227.00"),
        is_default=True,
    )
    food.servings.append(serving)
    created_food = await repo.create(food)
    assert created_food.id is not None

    # Get by id
    found_by_id = await repo.get_by_id(created_food.id)
    assert found_by_id is not None
    assert found_by_id.name == "Greek Yogurt Plain"
    assert len(found_by_id.servings) == 1

    # Get by USDA FDC ID
    found_by_fdc = await repo.get_by_fdc_id(2341234)
    assert found_by_fdc is not None
    assert found_by_fdc.id == created_food.id

    # Search by name
    results = await repo.search_by_name("yogurt")
    assert len(results) >= 1
    assert any(item.id == created_food.id for item in results)


@pytest.mark.asyncio
async def test_nutrition_repository(db_session: AsyncSession) -> None:
    user_repo = UserRepository(db_session)
    food_repo = FoodRepository(db_session)
    nutrition_repo = NutritionRepository(db_session)

    user = await user_repo.create(User(email="nutrition_repo@example.com", hashed_password="pw"))
    food = await food_repo.create(
        FoodItem(
            name="Brown Rice",
            calories_per_100g=Decimal("111.00"),
            protein_per_100g=Decimal("2.60"),
            carbs_per_100g=Decimal("23.00"),
            fat_per_100g=Decimal("0.90"),
        )
    )

    now = datetime.now(UTC)
    entry = FoodEntry(
        user_id=user.id,
        food_item_id=food.id,
        meal_type="dinner",
        quantity_g=Decimal("150.00"),
        food_name_snapshot="Brown Rice",
        calories=Decimal("166.50"),
        protein_g=Decimal("3.90"),
        carbs_g=Decimal("34.50"),
        fat_g=Decimal("1.35"),
        data_source_snapshot="usda",
        usda_fdc_id_snapshot=None,
        usda_dataset_version_snapshot=None,
        logged_at=now,
        log_date=date(2026, 9, 10),
    )
    created_entry = await nutrition_repo.create(entry)
    assert created_entry.id is not None

    # Get by id
    found_entry = await nutrition_repo.get_by_id(created_entry.id)
    assert found_entry is not None
    assert found_entry.calories == Decimal("166.50")

    # Get by user and date
    day_entries = await nutrition_repo.get_by_user_and_date(user.id, date(2026, 9, 10))
    assert len(day_entries) == 1
    assert day_entries[0].id == created_entry.id

    # Delete entry
    await nutrition_repo.delete(created_entry)
    assert await nutrition_repo.get_by_id(created_entry.id) is None


@pytest.mark.asyncio
async def test_weight_repository(db_session: AsyncSession) -> None:
    user_repo = UserRepository(db_session)
    weight_repo = WeightRepository(db_session)

    user = await user_repo.create(User(email="weight_repo@example.com", hashed_password="pw"))
    now = datetime.now(UTC)

    entry1 = await weight_repo.create(
        WeightEntry(
            user_id=user.id,
            weight_kg=Decimal("80.00"),
            logged_at=now,
            log_date=date(2026, 9, 1),
            notes="Starting weight",
        )
    )
    entry2 = await weight_repo.create(
        WeightEntry(
            user_id=user.id,
            weight_kg=Decimal("79.20"),
            logged_at=now,
            log_date=date(2026, 9, 8),
            notes="Week 1 weigh-in",
        )
    )

    # Get by user and date
    found = await weight_repo.get_by_user_and_date(user.id, date(2026, 9, 1))
    assert found is not None
    assert found.weight_kg == Decimal("80.00")

    # Get latest by user (authoritative source for profile read-cache)
    latest = await weight_repo.get_latest_by_user(user.id)
    assert latest is not None
    assert latest.id == entry2.id
    assert latest.weight_kg == Decimal("79.20")

    # Get history
    history = await weight_repo.get_history_by_user(user.id)
    assert len(history) == 2
    assert history[0].id == entry1.id
    assert history[1].id == entry2.id

    # Filtered history
    filtered = await weight_repo.get_history_by_user(user.id, start_date=date(2026, 9, 5))
    assert len(filtered) == 1
    assert filtered[0].id == entry2.id
