from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.context.builder import AIContextBuilder
from app.ai.providers.base import AbstractEmbedder, AbstractLLMProvider
from app.ai.providers.mock import MockEmbedder, MockLLMProvider
from app.ai.providers.openai import OpenAIEmbedder, OpenAIProvider
from app.api.dependencies.database import get_db
from app.core.config import get_settings
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.food_repository import FoodRepository
from app.repositories.knowledge_repository import KnowledgeRepository
from app.repositories.nutrition_repository import NutritionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workout_repository import WorkoutRepository
from app.services.ai_service import AIService
from app.services.nutrition_service import NutritionService
from app.services.rag_service import RAGService

_mock_llm_override: AbstractLLMProvider | None = None
_mock_embedder_override: AbstractEmbedder | None = None


def get_llm_provider() -> AbstractLLMProvider:
    if _mock_llm_override is not None:
        return _mock_llm_override
    settings = get_settings()
    if settings.OPENAI_API_KEY:
        return OpenAIProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_CHAT_MODEL,
        )
    return MockLLMProvider()


def get_embedder() -> AbstractEmbedder:
    if _mock_embedder_override is not None:
        return _mock_embedder_override
    settings = get_settings()
    if settings.OPENAI_API_KEY:
        return OpenAIEmbedder(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EMBEDDING_MODEL,
        )
    return MockEmbedder()


def get_rag_service(
    db: AsyncSession = Depends(get_db),
    embedder: AbstractEmbedder = Depends(get_embedder),
) -> RAGService:
    knowledge_repo = KnowledgeRepository(db)
    return RAGService(knowledge_repo=knowledge_repo, embedder=embedder)


def get_ai_service(
    db: AsyncSession = Depends(get_db),
    llm_provider: AbstractLLMProvider = Depends(get_llm_provider),
    rag_service: RAGService = Depends(get_rag_service),
) -> AIService:
    user_repo = UserRepository(db)
    workout_repo = WorkoutRepository(db)
    food_repo = FoodRepository(db)
    nutrition_repo = NutritionRepository(db)
    nutrition_service = NutritionService(nutrition_repo, food_repo)
    conversation_repo = ConversationRepository(db)

    context_builder = AIContextBuilder(
        user_repo=user_repo,
        workout_repo=workout_repo,
        nutrition_service=nutrition_service,
        rag_service=rag_service,
    )

    return AIService(
        llm_provider=llm_provider,
        context_builder=context_builder,
        conversation_repo=conversation_repo,
        food_repo=food_repo,
        nutrition_repo=nutrition_repo,
        nutrition_service=nutrition_service,
    )
