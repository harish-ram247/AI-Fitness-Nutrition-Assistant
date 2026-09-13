from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exercise import Exercise
from app.models.food import FoodItem, FoodItemServing
from app.models.goal import FitnessGoal
from app.models.nutrition import FoodEntry
from app.models.progress import WeightEntry
from app.models.user import User, UserPreference, UserProfile
from app.models.workout import WorkoutExercise, WorkoutSession, WorkoutSet


@pytest.mark.asyncio
async def test_user_profile_and_preferences_lifecycle(db_session: AsyncSession) -> None:
    """Verify User, UserProfile, and UserPreference persistence with PostgreSQL ARRAY."""
    # 1. Create User
    user = User(
        email="athlete@example.com",
        hashed_password="securely_hashed_password",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    # 2. Create UserProfile with current_weight_kg read-cache (ADR-014)
    profile = UserProfile(
        user_id=user.id,
        first_name="Jordan",
        last_name="Doe",
        date_of_birth=date(1992, 8, 15),
        sex="female",
        height_cm=Decimal("168.0"),
        current_weight_kg=Decimal("62.50"),  # Read-cache snapshot
        activity_level="active",
    )
    db_session.add(profile)

    # 3. Create UserPreference with native PostgreSQL ARRAY
    pref = UserPreference(
        user_id=user.id,
        unit_system="metric",
        calorie_target=2100,
        protein_target_g=Decimal("130.0"),
        carbs_target_g=Decimal("220.0"),
        fat_target_g=Decimal("65.0"),
        dietary_restrictions=["vegetarian", "gluten_free", "high_protein"],
        ai_persona="supportive",
    )
    db_session.add(pref)
    await db_session.commit()

    # Query back from PostgreSQL
    stmt = (
        select(User)
        .where(User.id == user.id)
        .options(selectinload(User.profile), selectinload(User.preferences))
    )
    res = await db_session.execute(stmt)
    loaded_user = res.scalar_one()

    assert loaded_user.email == "athlete@example.com"
    assert loaded_user.profile.first_name == "Jordan"
    assert loaded_user.profile.current_weight_kg == Decimal("62.50")
    # Verify native PostgreSQL ARRAY
    assert loaded_user.preferences.dietary_restrictions == [
        "vegetarian",
        "gluten_free",
        "high_protein",
    ]

    # Test cascade delete: deleting user deletes profile and preferences
    user_id = loaded_user.id
    await db_session.delete(loaded_user)
    await db_session.commit()

    profile_check = await db_session.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    assert profile_check.scalar_one_or_none() is None

    pref_check = await db_session.execute(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    assert pref_check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_fitness_goal_persistence_and_cascade(db_session: AsyncSession) -> None:
    """Verify FitnessGoal persistence, numeric precision, and cascade delete on user delete."""
    user = User(email="goal_user@example.com", hashed_password="pw")
    db_session.add(user)
    await db_session.flush()
    user_id = user.id

    goal = FitnessGoal(
        user_id=user_id,
        goal_type="muscle_gain",
        description="Gain 3kg lean mass",
        target_value=Decimal("75.00"),
        target_unit="kg",
        target_date=date(2026, 12, 31),
        status="active",
    )
    db_session.add(goal)
    await db_session.commit()

    stmt = select(FitnessGoal).where(FitnessGoal.user_id == user_id)
    loaded_goal = (await db_session.execute(stmt)).scalar_one()
    assert loaded_goal.goal_type == "muscle_gain"
    assert loaded_goal.target_value == Decimal("75.00")

    await db_session.delete(user)
    await db_session.commit()

    goal_check = await db_session.execute(
        select(FitnessGoal).where(FitnessGoal.user_id == user_id)
    )
    assert goal_check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_food_item_and_serving_cascade(db_session: AsyncSession) -> None:
    """Verify FoodItem persistence with USDA provenance columns and FoodItemServing cascade."""
    now = datetime.now(UTC)
    food = FoodItem(
        name="Greek Yogurt, Plain, Nonfat",
        calories_per_100g=Decimal("59.00"),
        protein_per_100g=Decimal("10.19"),
        carbs_per_100g=Decimal("3.60"),
        fat_per_100g=Decimal("0.39"),
        source="usda",
        usda_fdc_id=170889,
        usda_data_type="sr_legacy",
        usda_dataset_version="2024-10",
        usda_imported_at=now,
        is_verified=True,
    )
    db_session.add(food)
    await db_session.flush()
    food_id = food.id

    serving = FoodItemServing(
        food_item_id=food_id,
        description="1 container (170g)",
        grams=Decimal("170.00"),
        is_default=True,
    )
    db_session.add(serving)
    await db_session.commit()

    stmt = select(FoodItem).where(FoodItem.id == food_id).options(selectinload(FoodItem.servings))
    loaded_food = (await db_session.execute(stmt)).scalar_one()
    assert loaded_food.usda_fdc_id == 170889
    assert loaded_food.usda_data_type == "sr_legacy"
    assert len(loaded_food.servings) == 1
    assert loaded_food.servings[0].grams == Decimal("170.00")

    # Cascade delete: deleting FoodItem deletes FoodItemServing
    await db_session.delete(loaded_food)
    await db_session.commit()

    serving_check = await db_session.execute(
        select(FoodItemServing).where(FoodItemServing.food_item_id == food_id)
    )
    assert serving_check.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_food_entry_historical_snapshot_stability(db_session: AsyncSession) -> None:
    """Verify ADR-012/ADR-015 frozen snapshot immutability when mutable FoodItem is updated."""
    user = User(email="nutrition_user@example.com", hashed_password="pw")
    food = FoodItem(
        name="Rolled Oats",
        calories_per_100g=Decimal("389.00"),
        protein_per_100g=Decimal("16.89"),
        carbs_per_100g=Decimal("66.27"),
        fat_per_100g=Decimal("6.90"),
        source="usda",
        usda_fdc_id=1101825,
        usda_data_type="sr_legacy",
        usda_dataset_version="2024-10",
    )
    db_session.add_all([user, food])
    await db_session.flush()

    now = datetime.now(UTC)
    entry = FoodEntry(
        user_id=user.id,
        food_item_id=food.id,
        meal_type="breakfast",
        quantity_g=Decimal("50.00"),
        # 8 frozen snapshot columns
        food_name_snapshot="Rolled Oats",
        calories=Decimal("194.50"),
        protein_g=Decimal("8.45"),
        carbs_g=Decimal("33.14"),
        fat_g=Decimal("3.45"),
        data_source_snapshot="usda",
        usda_fdc_id_snapshot=1101825,
        usda_dataset_version_snapshot="2024-10",
        logged_at=now,
        log_date=date(2026, 9, 10),
        entry_source="manual",
    )
    db_session.add(entry)
    await db_session.commit()
    entry_id = entry.id

    # Mutate the source FoodItem
    food.name = "Rolled Oats - Revised Formulation"
    food.calories_per_100g = Decimal("410.00")
    food.protein_per_100g = Decimal("18.00")
    await db_session.commit()

    # Query back FoodEntry - snapshot columns MUST remain frozen
    loaded_entry = (
        await db_session.execute(select(FoodEntry).where(FoodEntry.id == entry_id))
    ).scalar_one()

    assert loaded_entry.food_name_snapshot == "Rolled Oats"
    assert loaded_entry.calories == Decimal("194.50")
    assert loaded_entry.protein_g == Decimal("8.45")
    assert loaded_entry.carbs_g == Decimal("33.14")
    assert loaded_entry.fat_g == Decimal("3.45")
    assert loaded_entry.usda_fdc_id_snapshot == 1101825


@pytest.mark.asyncio
async def test_food_entry_restrict_fk_behaviors(db_session: AsyncSession) -> None:
    """Verify ON DELETE RESTRICT on FoodEntry -> FoodItem and FoodEntry -> User."""
    user = User(email="restrict_user@example.com", hashed_password="pw")
    food = FoodItem(
        name="Apple",
        calories_per_100g=Decimal("52.00"),
        protein_per_100g=Decimal("0.26"),
        carbs_per_100g=Decimal("13.81"),
        fat_per_100g=Decimal("0.17"),
        source="usda",
    )
    db_session.add_all([user, food])
    await db_session.flush()

    now = datetime.now(UTC)
    entry = FoodEntry(
        user_id=user.id,
        food_item_id=food.id,
        meal_type="snack",
        quantity_g=Decimal("100.00"),
        food_name_snapshot="Apple",
        calories=Decimal("52.00"),
        protein_g=Decimal("0.26"),
        carbs_g=Decimal("13.81"),
        fat_g=Decimal("0.17"),
        data_source_snapshot="usda",
        logged_at=now,
        log_date=date(2026, 9, 10),
    )
    db_session.add(entry)
    await db_session.commit()

    # 1. Verify FoodEntry -> FoodItem RESTRICT behavior
    await db_session.delete(food)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()

    # Re-fetch managed objects after rollback
    managed_user = (
        await db_session.execute(select(User).where(User.email == "restrict_user@example.com"))
    ).scalar_one()

    # 2. Verify FoodEntry -> User RESTRICT behavior
    await db_session.delete(managed_user)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.asyncio
async def test_workout_hierarchy_cascade_and_restrict(db_session: AsyncSession) -> None:
    """Verify WorkoutSession -> WorkoutExercise -> WorkoutSet cascade and Exercise RESTRICT."""
    user = User(email="lifter@example.com", hashed_password="pw")
    exercise = Exercise(
        name="Barbell Deadlift",
        category="strength",
        muscle_groups=["hamstrings", "glutes", "lower_back"],
        equipment="barbell",
        is_verified=True,
    )
    db_session.add_all([user, exercise])
    await db_session.flush()
    exercise_id = exercise.id

    now = datetime.now(UTC)
    session = WorkoutSession(
        user_id=user.id,
        name="Pull Day",
        started_at=now,
        tags=["pull", "deadlifts"],
    )
    db_session.add(session)
    await db_session.flush()
    session_id = session.id

    w_exercise = WorkoutExercise(
        workout_session_id=session_id,
        exercise_id=exercise_id,
        order_index=1,
    )
    db_session.add(w_exercise)
    await db_session.flush()
    w_exercise_id = w_exercise.id

    w_set = WorkoutSet(
        workout_exercise_id=w_exercise_id,
        set_number=1,
        set_type="working",
        reps=5,
        weight_kg=Decimal("140.00"),
        rpe=Decimal("8.5"),
        completed=True,
    )
    db_session.add(w_set)
    await db_session.commit()

    # Verify WorkoutExercise -> Exercise ON DELETE RESTRICT behavior
    await db_session.delete(exercise)
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()

    # Re-fetch session after rollback
    managed_session = (
        await db_session.execute(
            select(WorkoutSession)
            .where(WorkoutSession.id == session_id)
            .options(selectinload(WorkoutSession.exercises).selectinload(WorkoutExercise.sets))
        )
    ).scalar_one()

    # Verify WorkoutSession cascade delete (WorkoutExercise and WorkoutSet deleted)
    await db_session.delete(managed_session)
    await db_session.commit()

    ex_check = await db_session.execute(
        select(WorkoutExercise).where(WorkoutExercise.workout_session_id == session_id)
    )
    assert ex_check.scalar_one_or_none() is None

    set_check = await db_session.execute(
        select(WorkoutSet).where(WorkoutSet.workout_exercise_id == w_exercise_id)
    )
    assert set_check.scalar_one_or_none() is None

    # Underlying Exercise catalog record must remain intact
    base_ex_check = await db_session.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    assert base_ex_check.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_weight_entry_authoritative_and_unique_per_date(db_session: AsyncSession) -> None:
    """Verify ADR-014 authoritative weight entry and database UNIQUE(user_id, log_date)."""
    user = User(email="weight_tracker@example.com", hashed_password="pw")
    db_session.add(user)
    await db_session.flush()
    user_id = user.id

    now = datetime.now(UTC)
    entry1 = WeightEntry(
        user_id=user_id,
        weight_kg=Decimal("78.50"),
        logged_at=now,
        log_date=date(2026, 9, 10),
        notes="Morning weigh-in",
    )
    db_session.add(entry1)
    await db_session.commit()

    # Duplicate log_date for same user must violate PostgreSQL UniqueConstraint
    entry2 = WeightEntry(
        user_id=user_id,
        weight_kg=Decimal("79.00"),
        logged_at=now,
        log_date=date(2026, 9, 10),
        notes="Evening weigh-in duplicate date",
    )
    db_session.add(entry2)
    with pytest.raises(IntegrityError) as excinfo:
        await db_session.commit()
    # Check that PostgreSQL unique constraint name is present in error
    assert "uq_weight_entries_user_id_log_date" in str(excinfo.value)
    await db_session.rollback()

    # Different date for same user succeeds
    entry3 = WeightEntry(
        user_id=user_id,
        weight_kg=Decimal("78.30"),
        logged_at=now,
        log_date=date(2026, 9, 11),
    )
    db_session.add(entry3)
    await db_session.commit()

    entries = (
        await db_session.execute(
            select(WeightEntry)
            .where(WeightEntry.user_id == user_id)
            .order_by(WeightEntry.log_date.asc())
        )
    ).scalars().all()
    assert len(entries) == 2
    assert entries[0].weight_kg == Decimal("78.50")
    assert entries[1].weight_kg == Decimal("78.30")
