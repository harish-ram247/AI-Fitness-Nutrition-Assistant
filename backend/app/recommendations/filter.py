from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext


class FilterResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    is_eligible: bool
    reason: str | None = None


@runtime_checkable
class CandidateFilter(Protocol):
    @property
    def name(self) -> str: ...

    def filter(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FilterResult:
        """Deterministically validate candidate against hard constraints."""
        ...
