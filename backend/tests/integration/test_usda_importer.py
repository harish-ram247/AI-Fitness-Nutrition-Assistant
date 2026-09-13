import json
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.food import FoodItem
from app.services.usda_importer import USDAImporter


@pytest.fixture
def sample_usda_data() -> dict[str, Any]:
    fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "usda_sample.json"
    with open(fixture_path, encoding="utf-8") as f:
        data: dict[str, Any] = json.load(f)
        return data


@pytest.mark.asyncio
async def test_usda_import_sample_fixture(
    db_session: AsyncSession, sample_usda_data: dict[str, Any]
) -> None:
    importer = USDAImporter(db_session)
    stats = await importer.import_from_json(sample_usda_data, dataset_version="October 2024")

    # 5 total records: 3 valid imported, 2 skipped (missing name and missing protein)
    assert stats.records_read == 5
    assert stats.records_imported == 3
    assert stats.records_skipped == 2
    assert stats.records_failed == 0
    assert stats.servings_imported == 4  # Chicken: 2, Egg: 1, Milk: 1

    # Verify Chicken Breast record & provenance
    stmt = (
        select(FoodItem)
        .where(FoodItem.usda_fdc_id == 170889)
        .options(selectinload(FoodItem.servings))
    )
    res = await db_session.execute(stmt)
    chicken = res.scalar_one_or_none()
    assert chicken is not None
    assert chicken.name == "Chicken, breast, meat only, cooked, roasted"
    assert chicken.calories_per_100g == Decimal("165.00")
    assert chicken.protein_per_100g == Decimal("31.02")
    assert chicken.fat_per_100g == Decimal("3.57")
    assert chicken.carbs_per_100g == Decimal("0.00")
    assert chicken.source == "usda"
    assert chicken.usda_data_type == "Foundation"
    assert chicken.usda_dataset_version == "October 2024"
    assert chicken.usda_imported_at is not None
    assert chicken.created_by_user_id is None
    assert chicken.is_verified is True
    assert len(chicken.servings) == 2

    # Verify servings order and default flag
    default_serving = next(s for s in chicken.servings if s.is_default)
    assert default_serving.description == "1 breast, bone and skin removed"
    assert default_serving.grams == Decimal("174.00")

    # Verify Milk record & optional nutrients policy (missing sodium is NULL, not 0.0)
    milk_stmt = select(FoodItem).where(FoodItem.usda_fdc_id == 1101825)
    milk_res = await db_session.execute(milk_stmt)
    milk = milk_res.scalar_one_or_none()
    assert milk is not None
    assert milk.sugar_per_100g == Decimal("4.81")
    assert milk.sodium_per_100g is None  # Must NOT be zero-filled


@pytest.mark.asyncio
async def test_usda_import_idempotency_and_no_duplicates(
    db_session: AsyncSession, sample_usda_data: dict[str, Any]
) -> None:
    importer = USDAImporter(db_session)

    # 1. First import
    stats1 = await importer.import_from_json(sample_usda_data, dataset_version="October 2024")
    assert stats1.records_imported == 3

    # Count items in database
    count1 = await db_session.scalar(select(func.count(FoodItem.id)))
    assert count1 == 3

    # 2. Re-import the exact same data
    stats2 = await importer.import_from_json(sample_usda_data, dataset_version="October 2024")
    assert stats2.records_imported == 0
    assert stats2.records_updated == 3

    # Total items in database must remain exactly 3 (no duplicate rows created)
    count2 = await db_session.scalar(select(func.count(FoodItem.id)))
    assert count2 == 3


@pytest.mark.asyncio
async def test_usda_nutrient_precedence_and_array_order_independence(
    db_session: AsyncSession,
) -> None:
    importer = USDAImporter(db_session)

    # Food with nutrient records ordered: Lower precedence first, higher precedence second
    nutrients_order_a = [
        # Protein: 1003 (lower) then 203 (higher)
        {
            "id": 1,
            "amount": 15.0,
            "nutrient": {"number": "1003", "name": "Protein", "unitName": "g"},
        },
        {
            "id": 2,
            "amount": 30.0,
            "nutrient": {"number": "203", "name": "Protein", "unitName": "g"},
        },
        # Energy: 208 (lower) then 1008 (higher)
        {
            "id": 3,
            "amount": 200.0,
            "nutrient": {"number": "208", "name": "Energy", "unitName": "kcal"},
        },
        {
            "id": 4,
            "amount": 100.0,
            "nutrient": {"number": "1008", "name": "Energy", "unitName": "kcal"},
        },
        # Carbs: 1005 (lower) then 205 (higher)
        {
            "id": 5,
            "amount": 5.0,
            "nutrient": {"number": "1005", "name": "Carbohydrate", "unitName": "g"},
        },
        {
            "id": 6,
            "amount": 10.0,
            "nutrient": {"number": "205", "name": "Carbohydrate, by difference", "unitName": "g"},
        },
        # Fat: 1004 (lower) then 204 (higher)
        {
            "id": 7,
            "amount": 2.0,
            "nutrient": {"number": "1004", "name": "Total lipid (fat)", "unitName": "g"},
        },
        {
            "id": 8,
            "amount": 4.0,
            "nutrient": {"number": "204", "name": "Total lipid (fat)", "unitName": "g"},
        },
    ]

    food_a = {
        "fdcId": 999901,
        "description": "Precedence Food A",
        "dataType": "Foundation",
        "foodNutrients": nutrients_order_a,
    }

    # Food with reversed nutrient array order
    food_b = {
        "fdcId": 999902,
        "description": "Precedence Food B",
        "dataType": "Foundation",
        "foodNutrients": list(reversed(nutrients_order_a)),
    }

    res_a = importer._process_raw_food(food_a, "test-version")
    res_b = importer._process_raw_food(food_b, "test-version")

    assert res_a is not None
    assert res_b is not None

    dict_a, _ = res_a
    dict_b, _ = res_b

    # Both must select the EXACT same higher-precedence values, independent of array order!
    assert dict_a["calories_per_100g"] == Decimal("100.00")
    assert dict_b["calories_per_100g"] == Decimal("100.00")

    assert dict_a["protein_per_100g"] == Decimal("30.00")
    assert dict_b["protein_per_100g"] == Decimal("30.00")

    assert dict_a["carbs_per_100g"] == Decimal("10.00")
    assert dict_b["carbs_per_100g"] == Decimal("10.00")

    assert dict_a["fat_per_100g"] == Decimal("4.00")
    assert dict_b["fat_per_100g"] == Decimal("4.00")


@pytest.mark.asyncio
async def test_usda_intra_tier_duplicate_tie_breaking(
    db_session: AsyncSession,
) -> None:
    importer = USDAImporter(db_session)

    # Duplicate records within the exact same tier (Nutrient 203) with different FDC IDs
    nutrients_order_a = [
        {
            "id": 10,
            "amount": 20.0,
            "nutrient": {"number": "203", "name": "Protein", "unitName": "g"},
        },
        {
            "id": 20,
            "amount": 25.0,
            "nutrient": {"number": "203", "name": "Protein", "unitName": "g"},
        },
        {
            "id": 1,
            "amount": 100.0,
            "nutrient": {"number": "1008", "name": "Energy", "unitName": "kcal"},
        },
        {
            "id": 2,
            "amount": 5.0,
            "nutrient": {"number": "205", "name": "Carbohydrate", "unitName": "g"},
        },
        {
            "id": 3,
            "amount": 2.0,
            "nutrient": {"number": "204", "name": "Total lipid", "unitName": "g"},
        },
    ]

    food_a = {
        "fdcId": 999903,
        "description": "Tie Breaker A",
        "dataType": "Foundation",
        "foodNutrients": nutrients_order_a,
    }

    food_b = {
        "fdcId": 999904,
        "description": "Tie Breaker B",
        "dataType": "Foundation",
        "foodNutrients": list(reversed(nutrients_order_a)),
    }

    res_a = importer._process_raw_food(food_a, "test-version")
    res_b = importer._process_raw_food(food_b, "test-version")

    assert res_a is not None
    assert res_b is not None

    dict_a, _ = res_a
    dict_b, _ = res_b

    # Deterministic tie breaker selects higher FDC measurement ID
    # (id=20 -> 25.0g) regardless of array order
    assert dict_a["protein_per_100g"] == Decimal("25.00")
    assert dict_b["protein_per_100g"] == Decimal("25.00")
