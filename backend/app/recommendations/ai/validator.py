"""Phase 7D – Strict server-side candidate validation for AI recommendation outputs."""

from __future__ import annotations

from dataclasses import dataclass

from app.recommendations.ai.models import RecommendationAIOutput


@dataclass(frozen=True)
class ValidationResult:
    """Result of validating an AI recommendation output against deterministic candidates."""

    is_valid: bool
    error_reason: str | None = None
    ranked_ids: list[str] | None = None
    item_explanations: dict[str, str] | None = None


class CandidateValidator:
    """Validates that LLM output respects deterministic candidate boundaries."""

    @staticmethod
    def validate(
        deterministic_candidate_ids: list[str],
        ai_output: RecommendationAIOutput,
    ) -> ValidationResult:
        """Validate LLM output against the known deterministic candidate IDs.

        Validation rules:
        1. If selected_candidate_id is present, it must exist in deterministic_candidate_ids.
        2. Every ranked_candidate_id must exist in deterministic_candidate_ids.
        3. ranked_candidate_ids must contain no duplicates.
        4. If ranked_candidate_ids is provided, it must be a complete permutation of the
           deterministic candidate set (no omitted candidates, no foreign candidates).
           An empty ranked_candidate_ids is accepted as "no re-ranking requested".
        5. Every candidate_id in item_explanations must exist in deterministic_candidate_ids.
        6. No invented, unknown, or malformed candidate IDs are permitted anywhere.
        """
        valid_set = set(deterministic_candidate_ids)

        # Rule 1: Validate selected_candidate_id
        if ai_output.selected_candidate_id is not None:
            if ai_output.selected_candidate_id not in valid_set:
                return ValidationResult(
                    is_valid=False,
                    error_reason=(
                        f"Unknown selected_candidate_id '{ai_output.selected_candidate_id}' "
                        f"not found in deterministic candidate set."
                    ),
                )

        # Rule 2, 3, 4: Validate ranked_candidate_ids
        ranked_ids: list[str] | None = None
        if ai_output.ranked_candidate_ids:
            # Check for duplicates
            if len(ai_output.ranked_candidate_ids) != len(set(ai_output.ranked_candidate_ids)):
                return ValidationResult(
                    is_valid=False,
                    error_reason="Duplicate candidate IDs found in AI ranking.",
                )

            # Check for unknown / invented IDs
            ranked_set = set(ai_output.ranked_candidate_ids)
            foreign_ids = ranked_set - valid_set
            if foreign_ids:
                return ValidationResult(
                    is_valid=False,
                    error_reason=(
                        "AI ranking contains unauthorized / invented candidate IDs: "
                        f"{sorted(foreign_ids)}"
                    ),
                )

            # Check complete permutation (Rule 7: require every candidate to be present)
            if len(ai_output.ranked_candidate_ids) != len(deterministic_candidate_ids):
                return ValidationResult(
                    is_valid=False,
                    error_reason=(
                        f"Incomplete AI ranking: expected {len(deterministic_candidate_ids)} "
                        f"candidates, got {len(ai_output.ranked_candidate_ids)}."
                    ),
                )

            ranked_ids = list(ai_output.ranked_candidate_ids)

        # Rule 5: Validate item_explanations
        item_explanations_dict: dict[str, str] = {}
        for item in ai_output.item_explanations:
            if item.candidate_id not in valid_set:
                return ValidationResult(
                    is_valid=False,
                    error_reason=(
                        f"Item explanation references unknown candidate_id '{item.candidate_id}'."
                    ),
                )
            item_explanations_dict[item.candidate_id] = item.explanation

        return ValidationResult(
            is_valid=True,
            ranked_ids=ranked_ids,
            item_explanations=item_explanations_dict,
        )
