from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.recommendations.exceptions import InvalidCandidateError
from app.recommendations.types import RecommendationType

T = TypeVar("T")


class RecommendationCandidate(BaseModel, Generic[T]):
    model_config = ConfigDict(frozen=True)

    id: str
    recommendation_type: RecommendationType
    payload: T
    metadata: dict[str, Any] = Field(default_factory=dict)
    eligibility_metadata: dict[str, Any] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v: Any) -> str:
        if not isinstance(v, str) or not v.strip():
            raise InvalidCandidateError("Candidate ID must be a non-empty string.")
        return v.strip()
