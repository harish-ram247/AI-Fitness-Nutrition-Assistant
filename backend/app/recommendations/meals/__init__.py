"""Phase 7B – Meal Recommendations package."""

from app.recommendations.meals.context_builder import MealRecommendationContextBuilder
from app.recommendations.meals.filters import (
    MealAllergyFilter,
    MealCalorieCeilingFilter,
    MealDietaryRestrictionFilter,
    MealDislikedFoodFilter,
    MealNutrientCompletenessFilter,
)
from app.recommendations.meals.generator import MealCandidateGenerator
from app.recommendations.meals.models import MealFoodItem, MealPayload
from app.recommendations.meals.scoring import (
    MealCalorieProximityFactor,
    MealGoalAlignmentFactor,
    MealMacroBalanceFactor,
    MealProteinProximityFactor,
)
from app.recommendations.meals.service import MealRecommendationService

__all__ = [
    "MealAllergyFilter",
    "MealCalorieCeilingFilter",
    "MealCalorieProximityFactor",
    "MealCandidateGenerator",
    "MealDietaryRestrictionFilter",
    "MealDislikedFoodFilter",
    "MealFoodItem",
    "MealGoalAlignmentFactor",
    "MealMacroBalanceFactor",
    "MealNutrientCompletenessFilter",
    "MealPayload",
    "MealProteinProximityFactor",
    "MealRecommendationContextBuilder",
    "MealRecommendationService",
]
