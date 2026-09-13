"""001_initial_schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-09-10 21:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_is_active", "users", ["is_active"])
    op.create_index("ix_users_deleted_at", "users", ["deleted_at"])

    # 2. user_profiles
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("sex", sa.String(10), nullable=True),
        sa.Column("height_cm", sa.Numeric(5, 1), nullable=True),
        sa.Column("current_weight_kg", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "activity_level",
            sa.String(20),
            nullable=False,
            server_default="sedentary",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 3. user_preferences
    op.create_table(
        "user_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column(
            "unit_system",
            sa.String(10),
            nullable=False,
            server_default="metric",
        ),
        sa.Column("calorie_target", sa.Integer(), nullable=True),
        sa.Column("protein_target_g", sa.Numeric(6, 1), nullable=True),
        sa.Column("carbs_target_g", sa.Numeric(6, 1), nullable=True),
        sa.Column("fat_target_g", sa.Numeric(6, 1), nullable=True),
        sa.Column(
            "dietary_restrictions",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "ai_persona",
            sa.String(20),
            nullable=False,
            server_default="balanced",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 4. fitness_goals
    op.create_table(
        "fitness_goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("goal_type", sa.String(30), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("target_value", sa.Numeric(6, 2), nullable=True),
        sa.Column("target_unit", sa.String(20), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="active",
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_fitness_goals_user_id_status",
        "fitness_goals",
        ["user_id", "status"],
    )

    # 5. food_items
    op.create_table(
        "food_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("brand", sa.String(255), nullable=True),
        sa.Column("barcode", sa.String(50), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("calories_per_100g", sa.Numeric(7, 2), nullable=False),
        sa.Column("protein_per_100g", sa.Numeric(6, 2), nullable=False),
        sa.Column("carbs_per_100g", sa.Numeric(6, 2), nullable=False),
        sa.Column("fat_per_100g", sa.Numeric(6, 2), nullable=False),
        sa.Column("fiber_per_100g", sa.Numeric(6, 2), nullable=True),
        sa.Column("sugar_per_100g", sa.Numeric(6, 2), nullable=True),
        sa.Column("sodium_per_100g", sa.Numeric(7, 2), nullable=True),
        sa.Column(
            "source",
            sa.String(20),
            nullable=False,
            server_default="usda",
        ),
        sa.Column("usda_fdc_id", sa.Integer(), nullable=True),
        sa.Column("usda_data_type", sa.String(50), nullable=True),
        sa.Column("usda_dataset_version", sa.String(20), nullable=True),
        sa.Column("usda_imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_food_items_name", "food_items", ["name"])
    op.create_index("ix_food_items_barcode", "food_items", ["barcode"], unique=True)
    op.create_index("ix_food_items_category", "food_items", ["category"])
    op.create_index("ix_food_items_source", "food_items", ["source"])
    op.create_index("ix_food_items_usda_fdc_id", "food_items", ["usda_fdc_id"], unique=True)
    op.create_index("ix_food_items_created_by_user_id", "food_items", ["created_by_user_id"])
    op.create_index("ix_food_items_deleted_at", "food_items", ["deleted_at"])
    op.create_index("ix_food_items_name_lower", "food_items", ["name"])

    # 6. food_item_servings
    op.create_table(
        "food_item_servings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "food_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("food_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("description", sa.String(100), nullable=False),
        sa.Column("grams", sa.Numeric(7, 2), nullable=False),
        sa.Column(
            "is_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.create_index("ix_food_item_servings_food_item_id", "food_item_servings", ["food_item_id"])

    # 7. food_entries
    op.create_table(
        "food_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "food_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("food_items.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("meal_type", sa.String(20), nullable=False),
        sa.Column("quantity_g", sa.Numeric(7, 2), nullable=False),
        # Snapshot columns
        sa.Column("food_name_snapshot", sa.String(255), nullable=False),
        sa.Column("calories", sa.Numeric(7, 2), nullable=False),
        sa.Column("protein_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("carbs_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("fat_g", sa.Numeric(6, 2), nullable=False),
        sa.Column("data_source_snapshot", sa.String(20), nullable=False),
        sa.Column("usda_fdc_id_snapshot", sa.Integer(), nullable=True),
        sa.Column("usda_dataset_version_snapshot", sa.String(20), nullable=True),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column(
            "entry_source",
            sa.String(20),
            nullable=False,
            server_default="manual",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_food_entries_food_item_id", "food_entries", ["food_item_id"])
    op.create_index("ix_food_entries_user_id_log_date", "food_entries", ["user_id", "log_date"])
    op.create_index(
        "ix_food_entries_user_meal_date",
        "food_entries",
        ["user_id", "meal_type", "log_date"],
    )
    op.create_index("ix_food_entries_deleted_at", "food_entries", ["deleted_at"])

    # 8. exercises
    op.create_table(
        "exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column(
            "muscle_groups",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("equipment", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("instructions", sa.Text(), nullable=True),
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_exercises_name", "exercises", ["name"])
    op.create_index("ix_exercises_category", "exercises", ["category"])
    op.create_index("ix_exercises_created_by_user_id", "exercises", ["created_by_user_id"])
    op.create_index("ix_exercises_deleted_at", "exercises", ["deleted_at"])
    op.create_index("ix_exercises_category_name", "exercises", ["category", "name"])

    # 9. workout_sessions
    op.create_table(
        "workout_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column(
            "tags",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_workout_sessions_user_id_started_at",
        "workout_sessions",
        ["user_id", "started_at"],
    )
    op.create_index("ix_workout_sessions_deleted_at", "workout_sessions", ["deleted_at"])

    # 10. workout_exercises
    op.create_table(
        "workout_exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workout_session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workout_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("exercises.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("order_index", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_workout_exercises_workout_session_id",
        "workout_exercises",
        ["workout_session_id"],
    )
    op.create_index(
        "ix_workout_exercises_exercise_id",
        "workout_exercises",
        ["exercise_id"],
    )

    # 11. workout_sets
    op.create_table(
        "workout_sets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workout_exercise_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workout_exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("set_number", sa.SmallInteger(), nullable=False),
        sa.Column(
            "set_type",
            sa.String(20),
            nullable=False,
            server_default="working",
        ),
        sa.Column("reps", sa.SmallInteger(), nullable=True),
        sa.Column("weight_kg", sa.Numeric(6, 2), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("distance_m", sa.Numeric(8, 2), nullable=True),
        sa.Column("rpe", sa.Numeric(3, 1), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_workout_sets_workout_exercise_id",
        "workout_sets",
        ["workout_exercise_id"],
    )

    # 12. weight_entries
    op.create_table(
        "weight_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("weight_kg", sa.Numeric(5, 2), nullable=False),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "log_date", name="uq_weight_entries_user_id_log_date"),
    )
    op.create_index(
        "ix_weight_entries_user_id_log_date",
        "weight_entries",
        ["user_id", "log_date"],
    )


def downgrade() -> None:
    op.drop_table("weight_entries")
    op.drop_table("workout_sets")
    op.drop_table("workout_exercises")
    op.drop_table("workout_sessions")
    op.drop_table("exercises")
    op.drop_table("food_entries")
    op.drop_table("food_item_servings")
    op.drop_table("food_items")
    op.drop_table("fitness_goals")
    op.drop_table("user_preferences")
    op.drop_table("user_profiles")
    op.drop_table("users")
