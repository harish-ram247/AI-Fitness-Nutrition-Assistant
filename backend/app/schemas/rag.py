import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=255)
    topic_category: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=10)
    source_url: str | None = Field(None, max_length=500)


class DocumentIngestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: uuid.UUID
    title: str
    status: str = "ingested"
    chunk_count: int


class DocumentSummaryRead(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: uuid.UUID
    title: str
    topic_category: str
    source_url: str | None
    checksum: str
    chunk_count: int
    created_at: datetime


class DocumentDetailRead(DocumentSummaryRead):
    pass


class ChunkSearchResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    section_title: str | None
    topic_category: str
    content: str
    similarity_score: float


class RAGSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(..., min_length=1)
    topic_category: str | None = None
    top_k: int = Field(5, ge=1, le=20)
    threshold: float = Field(0.70, ge=0.0, le=1.0)
