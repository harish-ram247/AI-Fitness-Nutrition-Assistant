from collections.abc import Sequence
from typing import Protocol, TypeVar, runtime_checkable

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext

T = TypeVar("T")


@runtime_checkable
class CandidateGenerator(Protocol[T]):
    async def generate_candidates(
        self, context: RecommendationContext
    ) -> Sequence[RecommendationCandidate[T]]:
        """Generate raw potential recommendation candidates based on context."""
        ...
