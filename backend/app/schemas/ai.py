import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: uuid.UUID | None = None


class ChatSourceRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunk_id: uuid.UUID
    document_title: str
    section_title: str | None
    similarity_score: float


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    conversation_id: uuid.UUID
    message_id: uuid.UUID
    response: str
    sources: list[ChatSourceRead] = []
    user_data_used: list[str] = []
    tokens_used: int = 0


class ConversationSummaryRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime


class MessageDetailRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    sources: list[ChatSourceRead] = []


class ConversationDetailRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageDetailRead] = []


class DailySummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str
    highlights: list[str]
    tokens_used: int = 0


class ConversationListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ConversationSummaryRead]
    total: int
    page: int
    size: int
    pages: int
