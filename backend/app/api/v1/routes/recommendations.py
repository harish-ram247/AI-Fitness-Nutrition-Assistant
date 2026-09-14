"""Phase 7B – Meal Recommendations API route.

GET /api/v1/recommendations/meals

Query parameters:
  meal_type        str  (optional) – breakfast|lunch|dinner|snack. Defaults to "lunch".
  target_calories  int  (optional) – explicit meal calorie target override (100–2500).
  allergies        str  (optional, repeatable) – allergy strings.
  disliked_foods   str  (optional, repeatable) – food names/substrings to exclude.
  limit            int  (optional) – max items returned (1–20, default 10).

Authentication: Bearer token required (get_current_user dependency).
No persistence. No LLM/RAG. No database migrations.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.recommendations.meals.context_builder import MealRecommendationContextBuilder
from app.recommendations.meals.service import MealRecommendationService
from app.repositories.food_repository import FoodRepository
from app.repositories.goal_repository import GoalRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.schemas.recommendation import MealRecommendationResponse
from app.services.nutrition_service import NutritionService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


def _get_meal_service(db: AsyncSession = Depends(get_db)) -> MealRecommendationService:
    nutrition_repo = NutritionRepository(db)
    food_repo = FoodRepository(db)
    nutrition_service = NutritionService(nutrition_repo, food_repo)
    goal_repo = GoalRepository(db)
    context_builder = MealRecommendationContextBuilder(
        nutrition_service=nutrition_service,
        goal_repository=goal_repo,
        db_session=db,
    )
    return MealRecommendationService(context_builder=context_builder)


@router.get(
    "/meals",
    response_model=MealRecommendationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get deterministic meal recommendations",
    description=(
        "Returns up to `limit` deterministic meal recommendations based on the user's "
        "nutritional targets, remaining daily calorie budget, dietary restrictions, and "
        "active fitness goal. No LLM or AI generation is involved."
    ),
)
async def get_meal_recommendations(
    meal_type: str | None = Query(
        None,
        description="Meal type: breakfast, lunch, dinner, snack. Defaults to 'lunch' if omitted.",
    ),
    target_calories: int | None = Query(
        None,
        ge=100,
        le=2500,
        description=(
            "Optional meal calorie target override. Required when calorie_target is not "
            "configured in user preferences."
        ),
    ),
    allergies: list[str] = Query(
        default_factory=list,
        description="List of allergy strings (canonical groups or literal food names).",
    ),
    disliked_foods: list[str] = Query(
        default_factory=list,
        description="List of food names/substrings to exclude from recommendations.",
    ),
    limit: int = Query(
        10,
        ge=1,
        le=20,
        description="Maximum number of meal recommendations to return.",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    meal_service: MealRecommendationService = Depends(_get_meal_service),
) -> Any:
    # Default meal_type to "lunch" with metadata flag
    effective_meal_type = meal_type if meal_type is not None else "lunch"
    meal_type_defaulted = meal_type is None

    result = await meal_service.recommend(
        user=current_user,
        meal_type=effective_meal_type,
        target_calories_override=target_calories,
        allergies=allergies,
        disliked_foods=disliked_foods,
        limit=limit,
        db_session=db,
    )

    if meal_type_defaulted:
        result.setdefault("metadata", {})
        result["metadata"]["meal_type_defaulted"] = True
        result["metadata"]["meal_type"] = "lunch"

    return result
