from typing import Any

from app.core.exceptions import AppException


class RecommendationError(AppException):
    """Base error for recommendation domain."""

    def __init__(self, message: str = "A recommendation error occurred.") -> None:
        super().__init__(message)


class InvalidRecommendationTypeError(RecommendationError):
    def __init__(self, rec_type: Any) -> None:
        super().__init__(f"Invalid recommendation type: {rec_type!r}")
        self.rec_type = rec_type


class InvalidTopNError(RecommendationError):
    def __init__(self, top_n: Any) -> None:
        super().__init__(f"top_n must be a positive integer >= 1 (got {top_n!r})")
        self.top_n = top_n


class InvalidScoringConfigurationError(RecommendationError):
    def __init__(self, message: str = "Invalid scoring configuration.") -> None:
        super().__init__(message)


class InvalidCandidateError(RecommendationError):
    def __init__(self, message: str = "Invalid candidate representation.") -> None:
        super().__init__(message)
