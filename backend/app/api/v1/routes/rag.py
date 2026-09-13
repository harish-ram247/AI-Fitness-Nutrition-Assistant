import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.admin import require_admin_key
from app.api.dependencies.ai import get_rag_service
from app.api.dependencies.database import get_db
from app.schemas.rag import (
    ChunkSearchResult,
    DocumentDetailRead,
    DocumentIngestRequest,
    DocumentIngestResponse,
    DocumentSummaryRead,
    RAGSearchRequest,
)
from app.services.rag_service import RAGService

router = APIRouter(
    prefix="/rag",
    tags=["rag"],
    dependencies=[Depends(require_admin_key)],
)


@router.post(
    "/documents",
    response_model=DocumentIngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a knowledge document (Admin)",
)
async def ingest_document(
    request: DocumentIngestRequest,
    db: AsyncSession = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service),
) -> Any:
    return await rag_service.ingest_document(
        db=db,
        title=request.title,
        topic_category=request.topic_category,
        content=request.content,
        source_url=request.source_url,
    )


@router.get(
    "/documents",
    response_model=list[DocumentSummaryRead],
    status_code=status.HTTP_200_OK,
    summary="List ingested knowledge documents (Admin)",
)
async def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service),
) -> Any:
    return await rag_service.list_documents(db=db, skip=skip, limit=limit)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentDetailRead,
    status_code=status.HTTP_200_OK,
    summary="Get knowledge document details (Admin)",
)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service),
) -> Any:
    return await rag_service.get_document(db=db, document_id=document_id)


@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a knowledge document and its chunks (Admin)",
)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service),
) -> None:
    await rag_service.delete_document(db=db, document_id=document_id)


@router.post(
    "/search",
    response_model=list[ChunkSearchResult],
    status_code=status.HTTP_200_OK,
    summary="Search knowledge chunks using pgvector cosine distance (Admin)",
)
async def search_chunks(
    request: RAGSearchRequest,
    db: AsyncSession = Depends(get_db),
    rag_service: RAGService = Depends(get_rag_service),
) -> Any:
    return await rag_service.search_chunks(
        db=db,
        query=request.query,
        topic_category=request.topic_category,
        top_k=request.top_k,
        threshold=request.threshold,
    )
