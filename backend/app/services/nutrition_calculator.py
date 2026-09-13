from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class CalculatedNutrients:
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


def calculate_food_nutrients(
    calories_per_100g: Decimal,
    protein_per_100g: Decimal,
    carbs_per_100g: Decimal,
    fat_per_100g: Decimal,
    quantity_g: Decimal,
) -> CalculatedNutrients:
    """Deterministically calculate nutritional values from per-100g base values and gram quantity.

    Formula:
        value = round(value_per_100g * quantity_g / 100.0, 2)
    Uses Python Decimal with ROUND_HALF_UP for accounting-grade accuracy without
    floating point drift.
    """
    if quantity_g <= Decimal("0.0"):
        raise ValueError("quantity_g must be strictly greater than zero")

    ratio = quantity_g / Decimal("100.0")
    two_places = Decimal("0.01")

    calories = (calories_per_100g * ratio).quantize(two_places, rounding=ROUND_HALF_UP)
    protein_g = (protein_per_100g * ratio).quantize(two_places, rounding=ROUND_HALF_UP)
    carbs_g = (carbs_per_100g * ratio).quantize(two_places, rounding=ROUND_HALF_UP)
    fat_g = (fat_per_100g * ratio).quantize(two_places, rounding=ROUND_HALF_UP)

    return CalculatedNutrients(
        calories=calories,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
    )


def calculate_serving_quantity(
    serving_grams: Decimal,
    serving_count: Decimal,
) -> Decimal:
    """Deterministically calculate total gram weight from serving weight and serving count."""
    if serving_count <= Decimal("0.0"):
        raise ValueError("serving_count must be strictly greater than zero")
    if serving_grams <= Decimal("0.0"):
        raise ValueError("serving_grams must be strictly greater than zero")

    return (serving_grams * serving_count).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
