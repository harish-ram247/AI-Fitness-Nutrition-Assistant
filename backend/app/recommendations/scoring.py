import math
from collections.abc import Sequence
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, field_validator

from app.recommendations.candidate import RecommendationCandidate
from app.recommendations.context import RecommendationContext
from app.recommendations.exceptions import InvalidScoringConfigurationError


class FactorScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    factor_name: str
    raw_score: float
    normalized_score: float
    weight: float
    weighted_contribution: float
    reason: str | None = None

    @field_validator(
        "raw_score", "normalized_score", "weight", "weighted_contribution", mode="before"
    )
    @classmethod
    def validate_numeric_fields(cls, v: Any, info: Any) -> Any:
        if isinstance(v, bool):
            raise InvalidScoringConfigurationError(
                f"Field '{info.field_name}' cannot be boolean: {v!r}"
            )
        if not isinstance(v, (int, float)) or math.isnan(v) or math.isinf(v):
            raise InvalidScoringConfigurationError(
                f"Field '{info.field_name}' must be a finite number: {v!r}"
            )
        if info.field_name == "normalized_score" and not (0.0 <= v <= 1.0):
            raise InvalidScoringConfigurationError(
                f"normalized_score {v!r} is outside bounded range [0.0, 1.0]"
            )
        return float(v)


@runtime_checkable
class ScoringFactor(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def weight(self) -> float: ...

    def score(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> FactorScore:
        """Compute normalized score [0.0, 1.0] and factor explanation."""
        ...


class RecommendationScorer:
    def __init__(self, factors: Sequence[ScoringFactor]) -> None:
        if not factors:
            raise InvalidScoringConfigurationError("At least one ScoringFactor is required.")

        seen_names: set[str] = set()
        total_weight = 0.0

        for factor in factors:
            if not factor.name or not factor.name.strip():
                raise InvalidScoringConfigurationError("ScoringFactor name cannot be empty.")
            if factor.name in seen_names:
                raise InvalidScoringConfigurationError(
                    f"Duplicate scoring factor name: '{factor.name}'."
                )
            seen_names.add(factor.name)

            # Explicitly reject bool weights because bool subclasses int in Python
            if isinstance(factor.weight, bool):
                raise InvalidScoringConfigurationError(
                    f"Factor '{factor.name}' weight cannot be boolean: {factor.weight!r}"
                )

            if (
                not isinstance(factor.weight, (int, float))
                or math.isnan(factor.weight)
                or math.isinf(factor.weight)
                or factor.weight <= 0.0
            ):
                raise InvalidScoringConfigurationError(
                    f"Factor '{factor.name}' weight must be a positive, finite number "
                    f"(got {factor.weight!r})"
                )

            total_weight += float(factor.weight)

        if total_weight <= 0.0 or math.isnan(total_weight) or math.isinf(total_weight):
            raise InvalidScoringConfigurationError(
                "Total factor weight must be positive and finite."
            )

        self._factors = tuple(factors)
        self._total_weight = total_weight

    @property
    def factors(self) -> tuple[ScoringFactor, ...]:
        return self._factors

    @property
    def total_weight(self) -> float:
        return self._total_weight

    def score_candidate(
        self,
        candidate: RecommendationCandidate[Any],
        context: RecommendationContext,
    ) -> tuple[float, list[FactorScore]]:
        """Score candidate deterministically, returning (final_score, list[FactorScore])."""
        factor_scores: list[FactorScore] = []
        weighted_sum = 0.0

        for factor in self._factors:
            f_score = factor.score(candidate, context)

            norm = f_score.normalized_score

            # Explicitly reject boolean scores
            if isinstance(norm, bool):
                raise InvalidScoringConfigurationError(
                    f"Factor '{factor.name}' returned boolean score: {norm!r}"
                )

            # Reject non-finite values
            if not isinstance(norm, (int, float)) or math.isnan(norm) or math.isinf(norm):
                raise InvalidScoringConfigurationError(
                    f"Factor '{factor.name}' returned non-finite score: {norm!r}"
                )

            # Reject values outside [0.0, 1.0] - do NOT silently clamp
            if norm < 0.0 or norm > 1.0:
                raise InvalidScoringConfigurationError(
                    f"Factor '{factor.name}' returned score {norm!r}, which is outside [0.0, 1.0]"
                )

            norm_float = float(norm)
            weighted_contrib = norm_float * float(factor.weight)
            weighted_sum += weighted_contrib

            factor_scores.append(
                FactorScore(
                    factor_name=factor.name,
                    raw_score=float(f_score.raw_score),
                    normalized_score=norm_float,
                    weight=float(factor.weight),
                    weighted_contribution=weighted_contrib,
                    reason=f_score.reason,
                )
            )

        final_score = weighted_sum / self._total_weight
        if (
            math.isnan(final_score)
            or math.isinf(final_score)
            or final_score < 0.0
            or final_score > 1.0
        ):
            raise InvalidScoringConfigurationError(
                f"Calculated final score is invalid or out of bounds: {final_score!r}"
            )

        return final_score, factor_scores
