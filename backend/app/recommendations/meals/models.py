"""Phase 7B – Meal recommendation domain models.

MealFoodItem: a single food component within a meal candidate, with resolved
nutrition already calculated by the generator.

MealPayload: the typed payload carried by a RecommendationCandidate[MealPayload]
for the meal domain.
"""

import uuid
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class MealFoodItem(BaseModel):
    """A single food component with pre-calculated nutrition for a given quantity."""

    model_config = ConfigDict(frozen=True)

    food_id: uuid.UUID
    food_name: str
    category: str | None = None
    quantity_g: Decimal
    serving_id: uuid.UUID | None = None
    serving_description: str
    serving_count: Decimal
    # Nutritional values pre-calculated for this quantity
    calories: Decimal
    protein_g: Decimal
    carbs_g: Decimal
    fat_g: Decimal


class MealPayload(BaseModel):
    """Domain payload for a meal recommendation candidate.

    Carries all computed totals and component breakdown so that filters and
    scoring factors can operate without re-deriving nutrition.
    """

    model_config = ConfigDict(frozen=True)

    meal_type: str
    components: list[MealFoodItem]

    # Totals (sum of all component nutritional values)
    total_calories: Decimal
    total_protein_g: Decimal
    total_carbs_g: Decimal
    total_fat_g: Decimal
