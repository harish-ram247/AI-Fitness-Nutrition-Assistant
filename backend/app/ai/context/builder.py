from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.intent import classify_intent
from app.ai.context.token_budget import TokenBudgetManager
from app.ai.prompts.assistant import format_rag_context, format_user_context
from app.ai.prompts.system import BASE_SYSTEM_PROMPT
from app.ai.providers.base import Message
from app.models.goal import FitnessGoal
from app.models.progress import WeightEntry
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.workout_repository import WorkoutRepository
from app.services.nutrition_service import NutritionService
from app.services.rag_service import RAGService


class AIContextBuilder:
    """Assembles intent-aware personal context and RAG knowledge within token budgets."""

    def __init__(
        self,
        user_repo: UserRepository,
        workout_repo: WorkoutRepository,
        nutrition_service: NutritionService,
        rag_service: RAGService,
        token_budget_manager: TokenBudgetManager | None = None,
    ) -> None:
        self.user_repo = user_repo
        self.workout_repo = workout_repo
        self.nutrition_service = nutrition_service
        self.rag_service = rag_service
        self.budget_manager = token_budget_manager or TokenBudgetManager(max_tokens=5000)

    async def build_context(
        self,
        db: AsyncSession,
        user: User,
        query: str,
        conversation_history: list[Message],
    ) -> tuple[list[Message], list[dict[str, Any]], list[str]]:
        intent = classify_intent(query)
        used_user_data: list[str] = ["user_profile"]

        # 1. Base user profile info (Data Minimization: NO email, password, address, exact DOB)
        profile = user.profile
        pref = user.preferences

        age: int | None = None
        if profile and profile.date_of_birth:
            today = datetime.now(UTC).date()
            age = (
                today.year
                - profile.date_of_birth.year
                - (
                    (today.month, today.day)
                    < (profile.date_of_birth.month, profile.date_of_birth.day)
                )
            )

        user_context_dict: dict[str, str | int | float | None] = {
            "age": age,
            "gender": profile.sex if profile else None,
            "height_cm": float(profile.height_cm) if profile and profile.height_cm else None,
            "weight_kg": float(profile.current_weight_kg)
            if profile and profile.current_weight_kg
            else None,
            "activity_level": profile.activity_level if profile else None,
            "extra_context": None,
        }

        # Active goal (query explicitly to avoid lazy-loading on async session)
        stmt_goal = select(FitnessGoal).where(
            FitnessGoal.user_id == user.id, FitnessGoal.status == "active"
        )
        res_goal = await db.execute(stmt_goal)
        active_goal = res_goal.scalars().first()
        if active_goal:
            used_user_data.append("fitness_goals")
            user_context_dict["goal_type"] = active_goal.goal_type

        if pref and pref.calorie_target:
            user_context_dict["target_calories"] = pref.calorie_target

        domain_context = ""
        topic_filter: str | None = None

        # 2. Intent-specific selective domain data retrieval
        if intent == "nutrition":
            topic_filter = "nutrition"
            used_user_data.append("nutrition_summary")
            today_utc = datetime.now(UTC).date()
            try:
                summary = await self.nutrition_service.get_daily_summary(
                    user_id=user.id,
                    log_date=today_utc,
                )
                domain_context = (
                    f"Today's Nutrition ({today_utc}):\n"
                    f"- Consumed: {summary.totals.calories:.0f} kcal\n"
                    f"- Protein: {summary.totals.protein_g:.1f}g\n"
                    f"- Carbs: {summary.totals.carbs_g:.1f}g\n"
                    f"- Fat: {summary.totals.fat_g:.1f}g"
                )
            except Exception:
                domain_context = "Today's Nutrition: No food entries logged yet today."

        elif intent == "workout":
            topic_filter = "training"
            used_user_data.append("workout_history")
            sessions, _, _ = await self.workout_repo.get_sessions_by_user(
                user_id=user.id,
                page=1,
                size=3,
            )
            if sessions:
                session_lines = []
                for s in sessions:
                    duration_str = f"{s.duration_minutes}m" if s.duration_minutes else "ongoing"
                    session_lines.append(
                        f"- {s.name} ({s.started_at.strftime('%Y-%m-%d')}, {duration_str})"
                    )
                domain_context = "Recent Workouts:\n" + "\n".join(session_lines)
            else:
                domain_context = "Recent Workouts: No recent workout sessions recorded."

        elif intent == "progress":
            topic_filter = "weight_management"
            used_user_data.append("weight_history")
            stmt_weight = (
                select(WeightEntry)
                .where(WeightEntry.user_id == user.id)
                .order_by(WeightEntry.logged_at.desc())
                .limit(5)
            )
            res_weight = await db.execute(stmt_weight)
            recent_weights = res_weight.scalars().all()
            if recent_weights:
                weight_lines = [
                    f"- {w.logged_at.strftime('%Y-%m-%d')}: {float(w.weight_kg):.1f} kg"
                    for w in recent_weights
                ]
                domain_context = "Recent Weight History:\n" + "\n".join(weight_lines)
            else:
                domain_context = "Recent Weight History: No weigh-in entries recorded."

        # 3. RAG Semantic Retrieval
        rag_results = await self.rag_service.search_chunks(
            db=db,
            query=query,
            topic_category=topic_filter,
            top_k=5,
            threshold=0.70,
        )
        rag_chunks_data: list[dict[str, str | float | None]] = [
            {
                "chunk_id": str(r.chunk_id),
                "document_title": r.document_title,
                "section_title": r.section_title,
                "content": r.content,
                "similarity_score": r.similarity_score,
            }
            for r in rag_results
        ]

        # 4. Token Budgeting & Priority Trimming
        profile_str = format_user_context(user_context_dict)
        trimmed_domain, trimmed_rag, trimmed_history = self.budget_manager.trim_context(
            system_prompt=BASE_SYSTEM_PROMPT,
            user_profile_context=profile_str,
            domain_context=domain_context,
            rag_chunks=rag_chunks_data,
            conversation_history=conversation_history,
            current_query=query,
        )

        # 5. Assemble final prompt messages
        rag_str = format_rag_context(trimmed_rag)
        full_system_message = (
            f"{BASE_SYSTEM_PROMPT}\n\n"
            f"=== USER PROFILE CONTEXT ===\n{profile_str}\n\n"
            f"=== DOMAIN DATA ===\n{trimmed_domain}\n\n"
            f"=== RETRIEVED REFERENCE DOCUMENTS ===\n{rag_str}\n"
        )

        messages: list[Message] = [Message(role="system", content=full_system_message)]
        messages.extend(trimmed_history)
        messages.append(Message(role="user", content=query))

        return messages, trimmed_rag, used_user_data
