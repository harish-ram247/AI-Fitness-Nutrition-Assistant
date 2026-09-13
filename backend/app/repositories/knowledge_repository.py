import uuid
from typing import Any

from sqlalchemy import CursorResult, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.knowledge import DocumentChunk, KnowledgeDocument
from app.repositories.base import BaseRepository


class KnowledgeRepository(BaseRepository):
    """Repository for managing RAG knowledge documents and semantic vector search."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)

    async def create_document(
        self,
        title: str,
        topic_category: str,
        checksum: str,
        source_url: str | None = None,
        db: AsyncSession | None = None,
    ) -> KnowledgeDocument:
        s = db or self.session
        doc = KnowledgeDocument(
            title=title,
            topic_category=topic_category,
            checksum=checksum,
            source_url=source_url,
        )
        s.add(doc)
        await s.flush()
        return doc

    async def add_chunks(
        self,
        chunks_data: list[dict[str, Any]],
        db: AsyncSession | None = None,
    ) -> list[DocumentChunk]:
        s = db or self.session
        chunks = [DocumentChunk(**data) for data in chunks_data]
        s.add_all(chunks)
        await s.flush()
        return chunks

    async def get_document_by_id(
        self,
        document_id: uuid.UUID,
        db: AsyncSession | None = None,
    ) -> KnowledgeDocument | None:
        s = db or self.session
        stmt = (
            select(KnowledgeDocument)
            .where(KnowledgeDocument.id == document_id)
            .options(selectinload(KnowledgeDocument.chunks))
        )
        result = await s.execute(stmt)
        return result.scalar_one_or_none()

    async def get_document_by_checksum(
        self,
        checksum: str,
        db: AsyncSession | None = None,
    ) -> KnowledgeDocument | None:
        s = db or self.session
        stmt = select(KnowledgeDocument).where(KnowledgeDocument.checksum == checksum)
        result = await s.execute(stmt)
        return result.scalar_one_or_none()

    async def list_documents(
        self,
        skip: int = 0,
        limit: int = 50,
        db: AsyncSession | None = None,
    ) -> list[tuple[KnowledgeDocument, int]]:
        s = db or self.session
        stmt = (
            select(
                KnowledgeDocument,
                func.count(DocumentChunk.id).label("chunk_count"),
            )
            .outerjoin(DocumentChunk, KnowledgeDocument.id == DocumentChunk.document_id)
            .group_by(KnowledgeDocument.id)
            .order_by(KnowledgeDocument.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await s.execute(stmt)
        return [(row[0], int(row[1])) for row in result.all()]

    async def delete_document(
        self,
        document_id: uuid.UUID,
        db: AsyncSession | None = None,
    ) -> bool:
        s = db or self.session
        stmt = delete(KnowledgeDocument).where(KnowledgeDocument.id == document_id)
        result = await s.execute(stmt)
        if isinstance(result, CursorResult):
            return bool(result.rowcount and result.rowcount > 0)
        return False

    async def search_similar_chunks(
        self,
        query_vector: list[float],
        topic_category: str | None = None,
        top_k: int = 5,
        threshold: float = 0.70,
        db: AsyncSession | None = None,
    ) -> list[tuple[DocumentChunk, KnowledgeDocument, float]]:
        """Search document chunks using native pgvector cosine distance (<=>)."""
        s = db or self.session
        max_distance = max(0.0, 1.0 - threshold)
        distance_col = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")

        stmt = (
            select(DocumentChunk, KnowledgeDocument, distance_col)
            .join(KnowledgeDocument, DocumentChunk.document_id == KnowledgeDocument.id)
            .where(distance_col <= max_distance)
        )

        if topic_category:
            stmt = stmt.where(DocumentChunk.topic_category == topic_category)

        stmt = stmt.order_by(distance_col.asc()).limit(top_k)

        result = await s.execute(stmt)
        rows = result.all()

        results: list[tuple[DocumentChunk, KnowledgeDocument, float]] = []
        for chunk, doc, dist in rows:
            similarity = max(0.0, min(1.0, 1.0 - float(dist)))
            results.append((chunk, doc, round(similarity, 4)))

        return results
