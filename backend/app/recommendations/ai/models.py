"""Phase 7D – Pydantic models for structured AI recommendation responses."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RecommendationItemExplanation(BaseModel):
    """Personalized explanation for an individual candidate recommendation."""

    model_config = ConfigDict(extra="forbid")

    candidate_id: str = Field(..., description="ID of the candidate being explained")
    explanation: str = Field(..., min_length=1, description="Personalized coaching explanation")


class RecommendationAIOutput(BaseModel):
    """Structured LLM output for recommendation explanation and optional constrained ranking."""

    model_config = ConfigDict(extra="forbid")

    selected_candidate_id: str | None = Field(
        default=None,
        description="ID of the single most recommended candidate from the candidate set.",
    )
    ranked_candidate_ids: list[str] = Field(
        default_factory=list,
        description="Complete permutation of supplied candidate IDs in coaching order.",
    )
    explanation: str = Field(
        default="",
        description="Overarching personalized rationale for how recommendations fit goals.",
    )
    item_explanations: list[RecommendationItemExplanation] = Field(
        default_factory=list,
        description="Individual explanations for each supplied candidate ID.",
    )
    considerations: list[str] = Field(
        default_factory=list,
        description="Practical coaching considerations, tips, or preparation advice.",
    )
    disclaimer: str | None = Field(
        default=None,
        description="Optional health or safety disclaimer contextualizing recommendations.",
    )
