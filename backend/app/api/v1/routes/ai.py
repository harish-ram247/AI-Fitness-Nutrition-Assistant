import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.ai import get_ai_service
from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.core.exceptions import NotFoundError
from app.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.ai import (
    ChatRequest,
    ChatResponse,
    ChatSourceRead,
    ConversationDetailRead,
    ConversationListResponse,
    ConversationSummaryRead,
    DailySummaryResponse,
    MessageDetailRead,
)
from app.services.ai_service import AIService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Send a message to the AI Assistant",
)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> Any:
    return await ai_service.chat(
        db=db,
        user=current_user,
        request=request,
    )


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all AI conversations for current user",
)
async def list_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    repo = ConversationRepository(db)
    skip = (page - 1) * size
    conversations, total = await repo.list_conversations(
        user_id=current_user.id,
        skip=skip,
        limit=size,
    )
    pages = (total + size - 1) // size if total > 0 else 0
    items = [ConversationSummaryRead.model_validate(c) for c in conversations]
    return ConversationListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailRead,
    status_code=status.HTTP_200_OK,
    summary="Get conversation detail and message history",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    repo = ConversationRepository(db)
    conversation = await repo.get_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    if not conversation:
        raise NotFoundError("AIConversation", conversation_id)

    messages_read: list[MessageDetailRead] = []
    for m in conversation.messages:
        sources_read = [
            ChatSourceRead(
                chunk_id=s.document_chunk_id,
                document_title=s.chunk.document.title
                if s.chunk and s.chunk.document
                else "Reference",
                section_title=s.chunk.section_title if s.chunk else None,
                similarity_score=float(s.similarity_score),
            )
            for s in m.sources
        ]
        messages_read.append(
            MessageDetailRead(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at,
                sources=sources_read,
            )
        )

    return ConversationDetailRead(
        id=conversation.id,
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=messages_read,
    )


@router.delete(
    "/conversations/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an AI conversation",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = ConversationRepository(db)
    deleted = await repo.delete_conversation(
        conversation_id=conversation_id,
        user_id=current_user.id,
    )
    if not deleted:
        raise NotFoundError("AIConversation", conversation_id)
    await db.commit()


@router.post(
    "/summarise-today",
    response_model=DailySummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate an AI narrative summary of today's nutrition",
)
async def summarise_today(
    target_date: date | None = Query(None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> Any:
    return await ai_service.summarise_today(
        db=db,
        user=current_user,
        target_date=target_date,
    )
