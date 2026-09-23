"""Phase 7D – Orchestrator for AI recommendation explanation, personalization, and ranking."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import AbstractLLMProvider, Message
from app.models.user import User
from app.recommendations.ai.models import RecommendationAIOutput
from app.recommendations.ai.prompts import (
    RECOMMENDATION_SYSTEM_PROMPT,
    build_meal_recommendation_prompt,
    build_workout_recommendation_prompt,
    format_meal_candidates,
    format_rag_evidence,
    format_user_context,
    format_workout_candidates,
)
from app.recommendations.ai.validator import CandidateValidator
from app.schemas.rag import ChunkSearchResult
from app.schemas.recommendation import MealRecommendationItem, WorkoutRecommendationItem
from app.services.rag_service import RAGService

logger = logging.getLogger(__name__)


class AIRecommendationService:
    """Orchestrates AI explanations, personalization, and validated ranking for recommendations.

    The deterministic engines remain the sole authority for candidates, nutrition/workout numbers,
    filtering, and safety constraints. The LLM serves solely as an explanation, coaching, and
    optional constrained re-ranking layer.
    """

    def __init__(
        self,
        llm_provider: AbstractLLMProvider,
        rag_service: RAGService | None = None,
        validator: CandidateValidator | None = None,
    ) -> None:
        self.llm_provider = llm_provider
        self.rag_service = rag_service
        self.validator = validator or CandidateValidator()

    @staticmethod
    def _extract_user_context(user: User, extra_context: dict[str, Any] | None = None) -> str:
        """Extract sanitized, privacy-conscious user profile attributes."""
        profile = getattr(user, "profile", None)
        age: int | None = None
        activity_level: str | None = None

        if profile:
            activity_level = getattr(profile, "activity_level", None)
            dob = getattr(profile, "date_of_birth", None)
            if dob:
                today = datetime.now(UTC).date()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        # Look for goal in active user goals or extra_context
        goal_type = (extra_context or {}).get("goal_type")

        return format_user_context(
            age=age,
            activity_level=activity_level,
            goal_type=goal_type,
            extra_context=extra_context,
        )

    async def _retrieve_rag_chunks(
        self,
        db: AsyncSession | None,
        query: str,
        topic_category: str,
    ) -> list[ChunkSearchResult]:
        """Safely retrieve informational RAG evidence without failing if DB or RAG is down."""
        if self.rag_service is None or db is None:
            return []
        try:
            return await self.rag_service.search_chunks(
                db=db,
                query=query,
                topic_category=topic_category,
                top_k=3,
                threshold=0.60,
            )
        except Exception as e:
            logger.warning(f"RAG retrieval skipped due to non-fatal error: {e}")
            return []

    async def enrich_meal_recommendations(
        self,
        user: User,
        response_dict: dict[str, Any],
        db: AsyncSession | None = None,
    ) -> dict[str, Any]:
        """Enrich deterministic meal recommendations with AI explanation and optional ranking."""
        items_raw = response_dict.get("items", [])
        if not items_raw:
            response_dict["ai_used"] = False
            response_dict["ai_fallback"] = False
            return response_dict

        # Collect deterministic candidate IDs in original rank order
        candidate_ids = [str(item["id"]) for item in items_raw]

        try:
            # 1. Parse candidates into schema objects for prompt formatting
            meal_items = [MealRecommendationItem.model_validate(item) for item in items_raw]
            candidates_text = format_meal_candidates(meal_items)

            # 2. Extract sanitized user context
            meal_type = response_dict.get("meal_type") or "lunch"
            extra_ctx: dict[str, Any] = {
                "meal_type": meal_type,
                "target_calories": response_dict.get("target_calories"),
            }
            user_context_text = self._extract_user_context(user, extra_context=extra_ctx)

            # 3. Retrieve informational RAG chunks (supporting evidence only)
            rag_query = f"{meal_type} meal planning nutrition"
            rag_chunks = await self._retrieve_rag_chunks(
                db=db,
                query=rag_query,
                topic_category="nutrition",
            )
            rag_text = format_rag_evidence(rag_chunks)

            # 4. Build prompt and invoke LLM
            user_prompt = build_meal_recommendation_prompt(
                user_context=user_context_text,
                rag_evidence=rag_text,
                candidates_text=candidates_text,
            )

            messages = [
                Message(role="system", content=RECOMMENDATION_SYSTEM_PROMPT),
                Message(role="user", content=user_prompt),
            ]

            ai_output = await self.llm_provider.structured_completion(
                messages=messages,
                response_model=RecommendationAIOutput,
                temperature=0.1,
            )

            # 5. Server-side validation of LLM output
            val_res = self.validator.validate(
                deterministic_candidate_ids=candidate_ids,
                ai_output=ai_output,
            )

            if not val_res.is_valid:
                logger.warning(
                    f"AI meal validation failed: {val_res.error_reason}. Using fallback."
                )
                response_dict["ai_used"] = False
                response_dict["ai_fallback"] = True
                meta = response_dict.setdefault("metadata", {})
                meta["ai_fallback_reason"] = val_res.error_reason
                return response_dict

            # 6. Apply validated AI enrichment
            items_by_id = {str(item["id"]): item for item in items_raw}

            # Optional validated reranking
            if val_res.ranked_ids:
                reordered_items = [items_by_id[cid] for cid in val_res.ranked_ids]
                for rank_idx, item in enumerate(reordered_items, start=1):
                    item["ai_rank"] = rank_idx
                response_dict["items"] = reordered_items
            else:
                for item in items_raw:
                    item["ai_rank"] = None

            # Attach per-item explanations
            for item in response_dict["items"]:
                cid = str(item["id"])
                item["ai_explanation"] = (val_res.item_explanations or {}).get(cid)

            # Set top-level AI metadata
            response_dict["ai_used"] = True
            response_dict["ai_fallback"] = False
            response_dict["ai_summary"] = ai_output.explanation
            response_dict["ai_considerations"] = ai_output.considerations
            if ai_output.disclaimer:
                response_dict.setdefault("metadata", {})["ai_disclaimer"] = ai_output.disclaimer

            return response_dict

        except Exception as e:
            logger.warning(
                f"AI meal recommendation failed ({e}). Falling back to deterministic results."
            )
            response_dict["ai_used"] = False
            response_dict["ai_fallback"] = True
            response_dict.setdefault("metadata", {})["ai_fallback_reason"] = str(e)
            return response_dict

    async def enrich_workout_recommendations(
        self,
        user: User,
        response_dict: dict[str, Any],
        db: AsyncSession | None = None,
    ) -> dict[str, Any]:
        """Enrich deterministic workout recommendations with AI explanation and optional ranking."""
        items_raw = response_dict.get("items", [])
        if not items_raw:
            response_dict["ai_used"] = False
            response_dict["ai_fallback"] = False
            return response_dict

        # Collect deterministic candidate IDs in original rank order
        candidate_ids = [str(item["id"]) for item in items_raw]

        try:
            # 1. Parse candidates into schema objects for prompt formatting
            workout_items = [WorkoutRecommendationItem.model_validate(item) for item in items_raw]
            candidates_text = format_workout_candidates(workout_items)

            # 2. Extract sanitized user context
            workout_type = response_dict.get("workout_type") or "full_body"
            extra_ctx: dict[str, Any] = {
                "workout_type": workout_type,
                "target_duration_minutes": response_dict.get("target_duration_minutes"),
            }
            user_context_text = self._extract_user_context(user, extra_context=extra_ctx)

            # 3. Retrieve informational RAG chunks
            rag_query = f"{workout_type} exercise training programming"
            rag_chunks = await self._retrieve_rag_chunks(
                db=db,
                query=rag_query,
                topic_category="training",
            )
            rag_text = format_rag_evidence(rag_chunks)

            # 4. Build prompt and invoke LLM
            user_prompt = build_workout_recommendation_prompt(
                user_context=user_context_text,
                rag_evidence=rag_text,
                candidates_text=candidates_text,
            )

            messages = [
                Message(role="system", content=RECOMMENDATION_SYSTEM_PROMPT),
                Message(role="user", content=user_prompt),
            ]

            ai_output = await self.llm_provider.structured_completion(
                messages=messages,
                response_model=RecommendationAIOutput,
                temperature=0.1,
            )

            # 5. Server-side validation of LLM output
            val_res = self.validator.validate(
                deterministic_candidate_ids=candidate_ids,
                ai_output=ai_output,
            )

            if not val_res.is_valid:
                logger.warning(
                    f"AI workout validation failed: {val_res.error_reason}. Using fallback."
                )
                response_dict["ai_used"] = False
                response_dict["ai_fallback"] = True
                meta = response_dict.setdefault("metadata", {})
                meta["ai_fallback_reason"] = val_res.error_reason
                return response_dict

            # 6. Apply validated AI enrichment
            items_by_id = {str(item["id"]): item for item in items_raw}

            # Optional validated reranking
            if val_res.ranked_ids:
                reordered_items = [items_by_id[cid] for cid in val_res.ranked_ids]
                for rank_idx, item in enumerate(reordered_items, start=1):
                    item["ai_rank"] = rank_idx
                response_dict["items"] = reordered_items
            else:
                for item in items_raw:
                    item["ai_rank"] = None

            # Attach per-item explanations
            for item in response_dict["items"]:
                cid = str(item["id"])
                item["ai_explanation"] = (val_res.item_explanations or {}).get(cid)

            # Set top-level AI metadata
            response_dict["ai_used"] = True
            response_dict["ai_fallback"] = False
            response_dict["ai_summary"] = ai_output.explanation
            response_dict["ai_considerations"] = ai_output.considerations
            if ai_output.disclaimer:
                response_dict.setdefault("metadata", {})["ai_disclaimer"] = ai_output.disclaimer

            return response_dict

        except Exception as e:
            logger.warning(
                f"AI workout recommendation failed ({e}). Falling back to deterministic results."
            )
            response_dict["ai_used"] = False
            response_dict["ai_fallback"] = True
            response_dict.setdefault("metadata", {})["ai_fallback_reason"] = str(e)
            return response_dict
