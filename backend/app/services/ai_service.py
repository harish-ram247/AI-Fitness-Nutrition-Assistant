import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.builder import AIContextBuilder
from app.ai.prompts.food_extraction import (
    FOOD_EXTRACTION_SYSTEM_PROMPT,
    ExtractedFoodList,
)
from app.ai.prompts.nutrition_summary import (
    NUTRITION_SUMMARY_SYSTEM_PROMPT,
    NutritionSummaryLLMOutput,
)
from app.ai.providers.base import AbstractLLMProvider, Message
from app.core.exceptions import BadRequestError, NotFoundError
from app.models.nutrition import FoodEntry
from app.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.food_repository import FoodRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ChatSourceRead,
    DailySummaryResponse,
)
from app.schemas.nutrition import (
    FoodEntryRead,
    NaturalLanguageConfirmRequest,
    NaturalLanguageLogPreview,
    NaturalLanguageLogRequest,
    ResolvedFoodItemPreview,
    UnresolvedFoodItem,
)
from app.services.nutrition_calculator import (
    calculate_food_nutrients,
    calculate_serving_quantity,
)
from app.services.nutrition_service import NutritionService


class AIService:
    """Orchestrator for AI chat, natural language food logging, and summaries."""

    def __init__(
        self,
        llm_provider: AbstractLLMProvider,
        context_builder: AIContextBuilder,
        conversation_repo: ConversationRepository,
        food_repo: FoodRepository,
        nutrition_repo: NutritionRepository,
        nutrition_service: NutritionService,
    ) -> None:
        self.llm_provider = llm_provider
        self.context_builder = context_builder
        self.conversation_repo = conversation_repo
        self.food_repo = food_repo
        self.nutrition_repo = nutrition_repo
        self.nutrition_service = nutrition_service

    async def log_natural_language(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: NaturalLanguageLogRequest,
    ) -> NaturalLanguageLogPreview:
        """Parse natural language meal text, resolve items in DB, and return calculation preview."""
        extraction_messages = [
            Message(role="system", content=FOOD_EXTRACTION_SYSTEM_PROMPT),
            Message(role="user", content=f"Extract food items from: '{request.text}'"),
        ]

        extracted_data: ExtractedFoodList = await self.llm_provider.structured_completion(
            messages=extraction_messages,
            response_model=ExtractedFoodList,
            temperature=0.1,
        )

        resolved_items: list[ResolvedFoodItemPreview] = []
        unresolved: list[UnresolvedFoodItem] = []

        total_calories = Decimal("0.0")
        total_protein = Decimal("0.0")
        total_carbs = Decimal("0.0")
        total_fat = Decimal("0.0")

        for item in extracted_data.items:
            # Match against database using catalog + custom search
            items, _, _ = await self.food_repo.search_foods(
                query=item.food_name,
                size=1,
                user_id=user_id,
            )

            if not items:
                unresolved.append(
                    UnresolvedFoodItem(
                        extracted_text=item.extracted_text,
                        recognized_name=item.food_name,
                        suggested_action=(
                            f"Could not find matching food for '{item.food_name}'."
                            " Please search catalog."
                        ),
                    )
                )
                continue

            matched_food = items[0]

            # Convert extracted unit to grams
            qty_g = Decimal(str(item.quantity))
            unit_lower = item.unit.lower()

            if unit_lower in ("g", "gram", "grams"):
                pass  # already in grams
            else:
                # Check if matching serving exists
                matched_serving = next(
                    (s for s in matched_food.servings if unit_lower in s.description.lower()),
                    None,
                )
                if matched_serving:
                    qty_g = calculate_serving_quantity(
                        matched_serving.grams, Decimal(str(item.quantity))
                    )
                elif unit_lower in ("piece", "whole", "large", "medium", "slice", "egg"):
                    # Use first serving if available, otherwise assume 100g
                    if matched_food.servings:
                        qty_g = calculate_serving_quantity(
                            matched_food.servings[0].grams, Decimal(str(item.quantity))
                        )
                    else:
                        qty_g = Decimal("100.0") * Decimal(str(item.quantity))
                else:
                    qty_g = Decimal("100.0")

            # Deterministic backend calculation
            nutrients = calculate_food_nutrients(
                calories_per_100g=matched_food.calories_per_100g,
                protein_per_100g=matched_food.protein_per_100g,
                carbs_per_100g=matched_food.carbs_per_100g,
                fat_per_100g=matched_food.fat_per_100g,
                quantity_g=qty_g,
            )

            resolved = ResolvedFoodItemPreview(
                extracted_text=item.extracted_text,
                food_item_id=matched_food.id,
                food_name=matched_food.name,
                quantity_g=qty_g,
                calories=nutrients.calories,
                protein_g=nutrients.protein_g,
                carbs_g=nutrients.carbs_g,
                fat_g=nutrients.fat_g,
                confidence="high",
            )
            resolved_items.append(resolved)

            total_calories += nutrients.calories
            total_protein += nutrients.protein_g
            total_carbs += nutrients.carbs_g
            total_fat += nutrients.fat_g

        return NaturalLanguageLogPreview(
            extraction_id=uuid.uuid4(),
            resolved_items=resolved_items,
            unresolved=unresolved,
            total_calories=round(total_calories, 1),
            total_protein_g=round(total_protein, 1),
            total_carbs_g=round(total_carbs, 1),
            total_fat_g=round(total_fat, 1),
        )

    async def confirm_natural_language(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        request: NaturalLanguageConfirmRequest,
    ) -> list[FoodEntryRead]:
        """Independently validates and recalculates nutrition for confirmed food items."""
        created_entries: list[FoodEntry] = []

        for item in request.confirmed_items:
            # 1. Validate food item existence and visibility
            food = await self.food_repo.get_by_id_scoped(item.food_item_id, user_id=user_id)
            if not food:
                raise NotFoundError("FoodItem", item.food_item_id)

            # 2. Validate quantity / serving
            if item.serving_id is not None:
                assert item.serving_count is not None
                serving = await self.food_repo.get_serving_by_id(item.serving_id)
                if not serving or serving.food_item_id != food.id:
                    raise BadRequestError("Serving does not belong to this food item")
                quantity_g = calculate_serving_quantity(serving.grams, item.serving_count)
            else:
                assert item.quantity_g is not None
                quantity_g = item.quantity_g

            # 3. Deterministically recalculate nutrition (Zero trust of client)
            nutrients = calculate_food_nutrients(
                calories_per_100g=food.calories_per_100g,
                protein_per_100g=food.protein_per_100g,
                carbs_per_100g=food.carbs_per_100g,
                fat_per_100g=food.fat_per_100g,
                quantity_g=quantity_g,
            )

            # 4. Normalize logged_at to UTC
            normalized_utc = item.logged_at.astimezone(UTC)
            log_date = normalized_utc.date()

            # 5. Persist FoodEntry with immutable snapshot
            entry = FoodEntry(
                id=uuid.uuid4(),
                user_id=user_id,
                food_item_id=food.id,
                meal_type=item.meal_type,
                quantity_g=quantity_g,
                food_name_snapshot=food.name,
                calories=nutrients.calories,
                protein_g=nutrients.protein_g,
                carbs_g=nutrients.carbs_g,
                fat_g=nutrients.fat_g,
                data_source_snapshot=food.source,
                usda_fdc_id_snapshot=food.usda_fdc_id,
                usda_dataset_version_snapshot=food.usda_dataset_version,
                logged_at=normalized_utc,
                log_date=log_date,
                entry_source="natural_language",
            )
            created = await self.nutrition_repo.create(entry)
            created_entries.append(created)

        return [FoodEntryRead.model_validate(e) for e in created_entries]

    async def chat(
        self,
        db: AsyncSession,
        user: User,
        request: ChatRequest,
    ) -> ChatResponse:
        """Handle multi-turn conversational chat with grounded personal context and citations."""
        # 1. Resolve or create conversation
        if request.conversation_id:
            conversation = await self.conversation_repo.get_conversation(
                db=db,
                conversation_id=request.conversation_id,
                user_id=user.id,
            )
            if not conversation:
                raise NotFoundError("AIConversation", request.conversation_id)
        else:
            # Derive title from first words of message
            title = request.message[:30].strip() + ("..." if len(request.message) > 30 else "")
            conversation = await self.conversation_repo.create_conversation(
                db=db,
                user_id=user.id,
                title=title,
            )

        # 2. Get recent history messages
        recent_messages = await self.conversation_repo.get_recent_messages(
            db=db,
            conversation_id=conversation.id,
            limit=6,
        )
        history_prompts = [
            Message(role=m.role, content=m.content)  # type: ignore[arg-type]
            for m in recent_messages
        ]

        # 3. Assemble intent-aware context
        messages, used_rag, used_user_data = await self.context_builder.build_context(
            db=db,
            user=user,
            query=request.message,
            conversation_history=history_prompts,
        )

        # 4. Generate completion
        completion = await self.llm_provider.complete(
            messages=messages,
            temperature=0.7,
            max_tokens=800,
        )

        # 5. Persist user and assistant messages
        await self.conversation_repo.add_message(
            db=db,
            conversation_id=conversation.id,
            role="user",
            content=request.message,
        )
        assistant_msg = await self.conversation_repo.add_message(
            db=db,
            conversation_id=conversation.id,
            role="assistant",
            content=completion.content,
            prompt_tokens=completion.prompt_tokens,
            completion_tokens=completion.completion_tokens,
            model=completion.model,
        )

        # 6. Persist response citations
        sources_to_save: list[tuple[uuid.UUID, float]] = []
        sources_read: list[ChatSourceRead] = []

        for chunk in used_rag:
            chunk_id = uuid.UUID(str(chunk["chunk_id"]))
            score = float(chunk["similarity_score"])
            sources_to_save.append((chunk_id, score))
            sources_read.append(
                ChatSourceRead(
                    chunk_id=chunk_id,
                    document_title=str(chunk.get("document_title", "")),
                    section_title=str(chunk.get("section_title", ""))
                    if chunk.get("section_title")
                    else None,
                    similarity_score=score,
                )
            )

        if sources_to_save:
            await self.conversation_repo.add_response_sources(
                db=db,
                message_id=assistant_msg.id,
                sources=sources_to_save,
            )

        await db.commit()

        return ChatResponse(
            conversation_id=conversation.id,
            message_id=assistant_msg.id,
            response=completion.content,
            sources=sources_read,
            user_data_used=used_user_data,
            tokens_used=completion.prompt_tokens + completion.completion_tokens,
        )

    async def summarise_today(
        self,
        db: AsyncSession,
        user: User,
        target_date: date | None = None,
    ) -> DailySummaryResponse:
        """Generate narrative summary and highlights from pre-calculated nutrition totals."""
        check_date = target_date or datetime.now(UTC).date()
        summary = await self.nutrition_service.get_daily_summary(
            user_id=user.id,
            log_date=check_date,
        )

        prompt_text = (
            f"Daily Nutrition Summary for {check_date}:\n"
            f"- Consumed Calories: {summary.totals.calories:.0f} kcal\n"
            f"- Protein: {summary.totals.protein_g:.1f}g\n"
            f"- Carbs: {summary.totals.carbs_g:.1f}g\n"
            f"- Fat: {summary.totals.fat_g:.1f}g\n"
        )

        messages = [
            Message(role="system", content=NUTRITION_SUMMARY_SYSTEM_PROMPT),
            Message(role="user", content=prompt_text),
        ]

        llm_out: NutritionSummaryLLMOutput = await self.llm_provider.structured_completion(
            messages=messages,
            response_model=NutritionSummaryLLMOutput,
            temperature=0.3,
        )

        return DailySummaryResponse(
            summary=llm_out.summary,
            highlights=llm_out.highlights,
            tokens_used=250,
        )
