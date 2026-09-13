import uuid
from decimal import Decimal

from sqlalchemy import CursorResult, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.conversation import AIConversation, AIMessage, AIResponseSource
from app.models.knowledge import DocumentChunk
from app.repositories.base import BaseRepository


class ConversationRepository(BaseRepository):
    """Repository for AI conversations, message turns, and citation sources."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def create_conversation(
        self,
        user_id: uuid.UUID,
        title: str = "New Conversation",
        db: AsyncSession | None = None,
    ) -> AIConversation:
        s = db or self.session
        conversation = AIConversation(user_id=user_id, title=title)
        s.add(conversation)
        await s.flush()
        return conversation

    async def get_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession | None = None,
    ) -> AIConversation | None:
        s = db or self.session
        stmt = (
            select(AIConversation)
            .where(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id,
            )
            .options(
                selectinload(AIConversation.messages)
                .selectinload(AIMessage.sources)
                .selectinload(AIResponseSource.chunk)
                .selectinload(DocumentChunk.document)
            )
        )
        result = await s.execute(stmt)
        return result.scalar_one_or_none()

    async def list_conversations(
        self,
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
        db: AsyncSession | None = None,
    ) -> tuple[list[AIConversation], int]:
        s = db or self.session
        count_stmt = (
            select(func.count(AIConversation.id))
            .where(AIConversation.user_id == user_id)
        )
        total = (await s.execute(count_stmt)).scalar() or 0

        stmt = (
            select(AIConversation)
            .where(AIConversation.user_id == user_id)
            .order_by(AIConversation.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await s.execute(stmt)
        return list(result.scalars().all()), total

    async def delete_conversation(
        self,
        conversation_id: uuid.UUID,
        user_id: uuid.UUID,
        db: AsyncSession | None = None,
    ) -> bool:
        s = db or self.session
        stmt = (
            delete(AIConversation)
            .where(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id,
            )
        )
        result = await s.execute(stmt)
        if isinstance(result, CursorResult):
            return bool(result.rowcount and result.rowcount > 0)
        return False

    async def add_message(
        self,
        conversation_id: uuid.UUID,
        role: str,
        content: str,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        model: str | None = None,
        db: AsyncSession | None = None,
    ) -> AIMessage:
        s = db or self.session
        message = AIMessage(
            conversation_id=conversation_id,
            role=role,
            content=content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=model,
        )
        s.add(message)
        await s.flush()
        return message

    async def add_response_sources(
        self,
        message_id: uuid.UUID,
        sources: list[tuple[uuid.UUID, float]],
        db: AsyncSession | None = None,
    ) -> list[AIResponseSource]:
        s = db or self.session
        db_sources = [
            AIResponseSource(
                ai_message_id=message_id,
                document_chunk_id=chunk_id,
                similarity_score=Decimal(str(round(score, 3))),
            )
            for chunk_id, score in sources
        ]
        s.add_all(db_sources)
        await s.flush()
        return db_sources

    async def get_recent_messages(
        self,
        conversation_id: uuid.UUID,
        limit: int = 10,
        db: AsyncSession | None = None,
    ) -> list[AIMessage]:
        s = db or self.session
        stmt = (
            select(AIMessage)
            .where(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.created_at.desc())
            .limit(limit)
        )
        result = await s.execute(stmt)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages
