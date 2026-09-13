import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from app.schemas.exercise import ExerciseRead
from app.schemas.food import FoodItemRead, FoodItemServingRead
from app.schemas.goal import FitnessGoalRead
from app.schemas.nutrition import FoodEntryRead
from app.schemas.progress import WeightEntryRead
from app.schemas.user import UserPreferenceRead, UserProfileRead, UserRead
from app.schemas.workout import WorkoutExerciseRead, WorkoutSessionRead, WorkoutSetRead


def test_user_schemas() -> None:
    user_id = uuid.uuid4()
    now = datetime.now(UTC)

    user = UserRead(
        id=user_id,
        email="athlete@example.com",
        is_active=True,
        is_verified=False,
        created_at=now,
        updated_at=now,
    )
    assert user.email == "athlete@example.com"

    profile = UserProfileRead(
        id=uuid.uuid4(),
        user_id=user_id,
        first_name="Alex",
        last_name="Johnson",
        date_of_birth=date(1995, 5, 20),
        sex="male",
        height_cm=Decimal("178.5"),
        current_weight_kg=Decimal("75.20"),  # Read-cache verified
        activity_level="moderate",
        created_at=now,
        updated_at=now,
    )
    assert profile.current_weight_kg == Decimal("75.20")
    assert profile.first_name == "Alex"

    pref = UserPreferenceRead(
        id=uuid.uuid4(),
        user_id=user_id,
        unit_system="metric",
        calorie_target=2200,
        protein_target_g=Decimal("160.0"),
        carbs_target_g=Decimal("220.0"),
        fat_target_g=Decimal("70.0"),
        dietary_restrictions=["high_protein"],
        ai_persona="analytical",
        created_at=now,
        updated_at=now,
    )
    assert pref.calorie_target == 2200
    assert pref.dietary_restrictions == ["high_protein"]


def test_goal_schemas() -> None:
    now = datetime.now(UTC)
    goal = FitnessGoalRead(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        goal_type="weight_loss",
        description="Reach 70kg target",
        target_value=Decimal("70.00"),
        target_unit="kg",
        target_date=date(2026, 12, 31),
        status="active",
        completed_at=None,
        created_at=now,
        updated_at=now,
    )
    assert goal.goal_type == "weight_loss"
    assert goal.target_value == Decimal("70.00")


def test_food_and_nutrition_schemas() -> None:
    now = datetime.now(UTC)
    food_id = uuid.uuid4()
    serving = FoodItemServingRead(
        id=uuid.uuid4(),
        food_item_id=food_id,
        description="1 cup chopped",
        grams=Decimal("140.00"),
        is_default=True,
    )
    assert serving.grams == Decimal("140.00")

    food = FoodItemRead(
        id=food_id,
        name="Chicken Breast, cooked",
        brand=None,
        barcode=None,
        category="Poultry Products",
        calories_per_100g=Decimal("165.00"),
        protein_per_100g=Decimal("31.02"),
        carbs_per_100g=Decimal("0.00"),
        fat_per_100g=Decimal("3.57"),
        fiber_per_100g=Decimal("0.00"),
        sugar_per_100g=Decimal("0.00"),
        sodium_per_100g=Decimal("74.00"),
        source="usda",
        usda_fdc_id=171077,
        usda_data_type="sr_legacy",
        usda_dataset_version="2024-10",
        usda_imported_at=now,
        is_verified=True,
        created_by_user_id=None,
        created_at=now,
        updated_at=now,
        servings=[serving],
    )
    assert food.usda_fdc_id == 171077
    assert len(food.servings) == 1

    entry = FoodEntryRead(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        food_item_id=food_id,
        meal_type="lunch",
        quantity_g=Decimal("200.00"),
        # Frozen historical snapshot
        food_name_snapshot="Chicken Breast, cooked",
        calories=Decimal("330.00"),
        protein_g=Decimal("62.04"),
        carbs_g=Decimal("0.00"),
        fat_g=Decimal("7.14"),
        data_source_snapshot="usda",
        usda_fdc_id_snapshot=171077,
        usda_dataset_version_snapshot="2024-10",
        logged_at=now,
        log_date=date(2026, 9, 10),
        entry_source="manual",
        created_at=now,
        updated_at=now,
    )
    assert entry.food_name_snapshot == "Chicken Breast, cooked"
    assert entry.calories == Decimal("330.00")
    assert entry.usda_fdc_id_snapshot == 171077


def test_exercise_and_workout_schemas() -> None:
    now = datetime.now(UTC)
    ex_id = uuid.uuid4()
    exercise = ExerciseRead(
        id=ex_id,
        name="Barbell Back Squat",
        category="strength",
        muscle_groups=["quadriceps", "glutes"],
        equipment="barbell",
        description="Compound lower body lift",
        instructions="Keep spine neutral and descend until hips below knees",
        is_verified=True,
        created_by_user_id=None,
        created_at=now,
    )
    assert exercise.name == "Barbell Back Squat"

    session_id = uuid.uuid4()
    w_ex_id = uuid.uuid4()
    w_set = WorkoutSetRead(
        id=uuid.uuid4(),
        workout_exercise_id=w_ex_id,
        set_number=1,
        set_type="working",
        reps=8,
        weight_kg=Decimal("100.00"),
        duration_seconds=None,
        distance_m=None,
        rpe=Decimal("8.0"),
        completed=True,
        created_at=now,
    )
    assert w_set.reps == 8
    assert w_set.weight_kg == Decimal("100.00")

    w_ex = WorkoutExerciseRead(
        id=w_ex_id,
        workout_session_id=session_id,
        exercise_id=ex_id,
        order_index=1,
        notes="Felt solid",
        sets=[w_set],
    )
    assert len(w_ex.sets) == 1

    session = WorkoutSessionRead(
        id=session_id,
        user_id=uuid.uuid4(),
        name="Leg Day",
        notes="Heavy squats session",
        started_at=now,
        ended_at=now,
        duration_minutes=60,
        tags=["legs", "hypertrophy"],
        created_at=now,
        exercises=[w_ex],
    )
    assert session.name == "Leg Day"
    assert len(session.exercises) == 1


def test_weight_entry_schema() -> None:
    now = datetime.now(UTC)
    weight_entry = WeightEntryRead(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        weight_kg=Decimal("75.40"),
        logged_at=now,
        log_date=date(2026, 9, 10),
        notes="Morning weigh-in before breakfast",
        created_at=now,
    )
    assert weight_entry.weight_kg == Decimal("75.40")
    assert weight_entry.log_date == date(2026, 9, 10)
