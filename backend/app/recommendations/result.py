from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.scoring import FactorScore
from app.recommendations.types import RecommendationType

T = TypeVar("T")


class ScoredCandidate(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)

    candidate: RecommendationCandidate[T]
    score: float
    factor_scores: list[FactorScore] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RecommendationResult(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)

    recommendation_type: RecommendationType
    ranked_candidates: list[ScoredCandidate[T]]
    total_generated: int
    total_survived_filtering: int
    metadata: dict[str, Any] = Field(default_factory=dict)
