from decimal import Decimal

import pytest

from app.services.nutrition_calculator import (
    calculate_food_nutrients,
    calculate_serving_quantity,
)


def test_100g_serving_identity() -> None:
    # 100g must return exact per-100g values
    res = calculate_food_nutrients(
        calories_per_100g=Decimal("165.00"),
        protein_per_100g=Decimal("31.02"),
        carbs_per_100g=Decimal("0.00"),
        fat_per_100g=Decimal("3.57"),
        quantity_g=Decimal("100.00"),
    )
    assert res.calories == Decimal("165.00")
    assert res.protein_g == Decimal("31.02")
    assert res.carbs_g == Decimal("0.00")
    assert res.fat_g == Decimal("3.57")


def test_50g_serving_scaling() -> None:
    # 50g must return exactly half
    res = calculate_food_nutrients(
        calories_per_100g=Decimal("200.00"),
        protein_per_100g=Decimal("20.00"),
        carbs_per_100g=Decimal("10.00"),
        fat_per_100g=Decimal("5.00"),
        quantity_g=Decimal("50.00"),
    )
    assert res.calories == Decimal("100.00")
    assert res.protein_g == Decimal("10.00")
    assert res.carbs_g == Decimal("5.00")
    assert res.fat_g == Decimal("2.50")


def test_150g_serving_scaling() -> None:
    # 150g example specified in requirements
    res = calculate_food_nutrients(
        calories_per_100g=Decimal("200.00"),
        protein_per_100g=Decimal("20.00"),
        carbs_per_100g=Decimal("10.00"),
        fat_per_100g=Decimal("5.00"),
        quantity_g=Decimal("150.00"),
    )
    assert res.calories == Decimal("300.00")
    assert res.protein_g == Decimal("30.00")
    assert res.carbs_g == Decimal("15.00")
    assert res.fat_g == Decimal("7.50")


def test_fractional_quantity_and_rounding() -> None:
    # 73.5g of food with 165 kcal / 100g
    # 165 * 0.735 = 121.275 -> rounds half up to 121.28
    res = calculate_food_nutrients(
        calories_per_100g=Decimal("165.00"),
        protein_per_100g=Decimal("31.00"),
        carbs_per_100g=Decimal("0.00"),
        fat_per_100g=Decimal("3.60"),
        quantity_g=Decimal("73.50"),
    )
    assert res.calories == Decimal("121.28")
    assert res.protein_g == Decimal("22.79")  # 31 * 0.735 = 22.785 -> 22.79
    assert res.carbs_g == Decimal("0.00")
    assert res.fat_g == Decimal("2.65")  # 3.60 * 0.735 = 2.646 -> 2.65


def test_zero_or_negative_quantity_raises_value_error() -> None:
    with pytest.raises(ValueError, match="quantity_g must be strictly greater than zero"):
        calculate_food_nutrients(
            calories_per_100g=Decimal("100"),
            protein_per_100g=Decimal("10"),
            carbs_per_100g=Decimal("10"),
            fat_per_100g=Decimal("5"),
            quantity_g=Decimal("0"),
        )

    with pytest.raises(ValueError, match="quantity_g must be strictly greater than zero"):
        calculate_food_nutrients(
            calories_per_100g=Decimal("100"),
            protein_per_100g=Decimal("10"),
            carbs_per_100g=Decimal("10"),
            fat_per_100g=Decimal("5"),
            quantity_g=Decimal("-15.5"),
        )


def test_serving_quantity_multiplication() -> None:
    # 1 serving = 174g, count = 2.5 -> 435g
    qty = calculate_serving_quantity(
        serving_grams=Decimal("174.00"),
        serving_count=Decimal("2.5"),
    )
    assert qty == Decimal("435.00")

    with pytest.raises(ValueError, match="serving_count must be strictly greater than zero"):
        calculate_serving_quantity(Decimal("100"), Decimal("0"))

    with pytest.raises(ValueError, match="serving_grams must be strictly greater than zero"):
        calculate_serving_quantity(Decimal("-50"), Decimal("1"))
