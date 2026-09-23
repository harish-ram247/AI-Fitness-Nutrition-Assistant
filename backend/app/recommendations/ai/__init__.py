"""Phase 7D – AI Recommendation Layer Package."""

from __future__ import annotations

from app.recommendations.ai.models import (
    RecommendationAIOutput,
    RecommendationItemExplanation,
)
from app.recommendations.ai.prompts import (
    RECOMMENDATION_SYSTEM_PROMPT,
    build_meal_recommendation_prompt,
    build_workout_recommendation_prompt,
    format_meal_candidates,
    format_rag_evidence,
    format_user_context,
    format_workout_candidates,
)
from app.recommendations.ai.service import AIRecommendationService
from app.recommendations.ai.validator import CandidateValidator, ValidationResult

__all__ = [
    "AIRecommendationService",
    "CandidateValidator",
    "RECOMMENDATION_SYSTEM_PROMPT",
    "RecommendationAIOutput",
    "RecommendationItemExplanation",
    "ValidationResult",
    "build_meal_recommendation_prompt",
    "build_workout_recommendation_prompt",
    "format_meal_candidates",
    "format_rag_evidence",
    "format_user_context",
    "format_workout_candidates",
]
