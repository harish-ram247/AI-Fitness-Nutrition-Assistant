from collections.abc import Sequence
from typing import Generic, TypeVar

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.exceptions import (
    InvalidRecommendationTypeError,
    InvalidTopNError,
)
from app.recommendations.filter import CandidateFilter
from app.recommendations.generator import CandidateGenerator
from app.recommendations.result import RecommendationResult, ScoredCandidate
from app.recommendations.scoring import RecommendationScorer
from app.recommendations.types import RecommendationType

T = TypeVar("T")


class RecommendationEngine(Generic[T]):
    """Generic, deterministic recommendation engine decoupled from domain specifics and LLMs."""

    def __init__(
        self,
        generator: CandidateGenerator[T],
        scorer: RecommendationScorer,
        filters: Sequence[CandidateFilter] | None = None,
    ) -> None:
        self.generator = generator
        self.scorer = scorer
        self.filters = tuple(filters) if filters is not None else ()

    async def recommend(
        self, context: RecommendationContext, top_n: int = 5
    ) -> RecommendationResult[T]:
        """Execute the recommendation pipeline deterministically."""
        # 1. Strict validation of top_n (reject bools because bool subclasses int)
        if isinstance(top_n, bool) or not isinstance(top_n, int) or top_n <= 0:
            raise InvalidTopNError(top_n)

        # 2. Strict validation of recommendation type
        if not isinstance(context.recommendation_type, RecommendationType):
            raise InvalidRecommendationTypeError(context.recommendation_type)

        # 3. Generate raw candidates asynchronously
        raw_candidates = await self.generator.generate_candidates(context)
        total_generated = len(raw_candidates)

        # 4. Filter candidates deterministically (synchronous)
        surviving_candidates: list[RecommendationCandidate[T]] = []
        for candidate in raw_candidates:
            eligible = True
            for filter_ in self.filters:
                filter_res = filter_.filter(candidate, context)
                if not filter_res.is_eligible:
                    eligible = False
                    break
            if eligible:
                surviving_candidates.append(candidate)

        total_survived = len(surviving_candidates)
        if total_survived == 0:
            return RecommendationResult(
                recommendation_type=context.recommendation_type,
                ranked_candidates=[],
                total_generated=total_generated,
                total_survived_filtering=0,
                metadata={"reason": "No candidates survived filtering."},
            )

        # 5. Score valid candidates deterministically (synchronous)
        scored_list: list[ScoredCandidate[T]] = []
        for candidate in surviving_candidates:
            score, factor_scores = self.scorer.score_candidate(candidate, context)
            reasons = list(candidate.reasons) + [
                fs.reason for fs in factor_scores if fs.reason is not None
            ]
            scored_list.append(
                ScoredCandidate(
                    candidate=candidate,
                    score=score,
                    factor_scores=factor_scores,
                    reasons=reasons,
                    metadata=dict(candidate.metadata),
                )
            )

        # 6. Deterministic sorting: final_score descending, candidate.id ascending
        sorted_candidates = sorted(
            scored_list,
            key=lambda item: (-item.score, item.candidate.id),
        )

        # 7. Select top-N
        ranked_top = sorted_candidates[:top_n]

        return RecommendationResult(
            recommendation_type=context.recommendation_type,
            ranked_candidates=ranked_top,
            total_generated=total_generated,
            total_survived_filtering=total_survived,
            metadata={},
        )
