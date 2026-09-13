import hashlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.providers.base import AbstractEmbedder
from app.core.exceptions import ConflictError, NotFoundError
from app.rag.chunker import RecursiveMarkdownChunker
from app.repositories.knowledge_repository import KnowledgeRepository
from app.schemas.rag import (
    ChunkSearchResult,
    DocumentDetailRead,
    DocumentIngestResponse,
    DocumentSummaryRead,
)


class RAGService:
    """Orchestrator for RAG knowledge ingestion and semantic vector retrieval."""

    def __init__(
        self,
        knowledge_repo: KnowledgeRepository,
        embedder: AbstractEmbedder,
        chunker: RecursiveMarkdownChunker | None = None,
    ) -> None:
        self.knowledge_repo = knowledge_repo
        self.embedder = embedder
        self.chunker = chunker or RecursiveMarkdownChunker()

    async def ingest_document(
        self,
        db: AsyncSession,
        title: str,
        topic_category: str,
        content: str,
        source_url: str | None = None,
    ) -> DocumentIngestResponse:
        checksum = hashlib.sha256(content.encode("utf-8")).hexdigest()

        # Check for duplicate document
        existing = await self.knowledge_repo.get_document_by_checksum(checksum=checksum, db=db)
        if existing:
            raise ConflictError(
                f"Document with identical content already ingested (ID: {existing.id})"
            )

        # 1. Chunk document
        chunks = self.chunker.chunk_document(content)
        if not chunks:
            chunks = self.chunker.chunk_document(content)  # Ensure at least 1 chunk

        # 2. Embed chunk texts with contextual document and section titles
        chunk_texts = [
            f"{title} - {c.section_title}\n{c.content}"
            if c.section_title
            else f"{title}\n{c.content}"
            for c in chunks
        ]
        embeddings = await self.embedder.embed_documents(chunk_texts)

        # 3. Create document record
        doc = await self.knowledge_repo.create_document(
            title=title,
            topic_category=topic_category,
            checksum=checksum,
            source_url=source_url,
            db=db,
        )

        # 4. Prepare and persist chunk records
        chunks_data = [
            {
                "document_id": doc.id,
                "chunk_index": c.chunk_index,
                "content": c.content,
                "content_length": c.content_length,
                "section_title": c.section_title,
                "topic_category": topic_category,
                "embedding": embeddings[i],
                "embedding_model": f"model-dim-{self.embedder.dimension}",
            }
            for i, c in enumerate(chunks)
        ]
        await self.knowledge_repo.add_chunks(chunks_data=chunks_data, db=db)
        await db.commit()

        return DocumentIngestResponse(
            document_id=doc.id,
            title=doc.title,
            status="ingested",
            chunk_count=len(chunks),
        )

    async def search_chunks(
        self,
        db: AsyncSession,
        query: str,
        topic_category: str | None = None,
        top_k: int = 5,
        threshold: float = 0.70,
    ) -> list[ChunkSearchResult]:
        query_vector = await self.embedder.embed_query(query)
        results = await self.knowledge_repo.search_similar_chunks(
            query_vector=query_vector,
            topic_category=topic_category,
            top_k=top_k,
            threshold=threshold,
            db=db,
        )

        return [
            ChunkSearchResult(
                chunk_id=chunk.id,
                document_id=doc.id,
                document_title=doc.title,
                section_title=chunk.section_title,
                topic_category=chunk.topic_category,
                content=chunk.content,
                similarity_score=score,
            )
            for chunk, doc, score in results
        ]

    async def list_documents(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 50,
    ) -> list[DocumentSummaryRead]:
        rows = await self.knowledge_repo.list_documents(skip=skip, limit=limit, db=db)
        return [
            DocumentSummaryRead(
                id=doc.id,
                title=doc.title,
                topic_category=doc.topic_category,
                source_url=doc.source_url,
                checksum=doc.checksum,
                chunk_count=chunk_count,
                created_at=doc.created_at,
            )
            for doc, chunk_count in rows
        ]

    async def get_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> DocumentDetailRead:
        doc = await self.knowledge_repo.get_document_by_id(document_id=document_id, db=db)
        if not doc:
            raise NotFoundError("KnowledgeDocument", document_id)

        return DocumentDetailRead(
            id=doc.id,
            title=doc.title,
            topic_category=doc.topic_category,
            source_url=doc.source_url,
            checksum=doc.checksum,
            chunk_count=len(doc.chunks),
            created_at=doc.created_at,
        )

    async def delete_document(
        self,
        db: AsyncSession,
        document_id: uuid.UUID,
    ) -> None:
        deleted = await self.knowledge_repo.delete_document(document_id=document_id, db=db)
        if not deleted:
            raise NotFoundError("KnowledgeDocument", document_id)
        await db.commit()
