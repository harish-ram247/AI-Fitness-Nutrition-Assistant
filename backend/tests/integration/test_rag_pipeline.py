from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.database import get_db
from app.core.config import get_settings
from app.main import app

settings = get_settings()
ADMIN_HEADERS = {"X-Admin-Key": settings.ADMIN_API_KEY}


@pytest.fixture
async def client(db_session: AsyncSession) -> Any:
    async def override_get_db() -> Any:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_rag_admin_security_enforcement(client: AsyncClient) -> None:
    # 1. Missing admin header -> 403
    res_no_header = await client.post(
        "/api/v1/rag/documents",
        json={"title": "Test", "topic_category": "general", "content": "Content"},
    )
    assert res_no_header.status_code == 403

    # 2. Invalid admin header -> 403
    res_invalid_header = await client.post(
        "/api/v1/rag/documents",
        headers={"X-Admin-Key": "wrong-secret-key"},
        json={"title": "Test", "topic_category": "general", "content": "Content"},
    )
    assert res_invalid_header.status_code == 403

    # 3. GET endpoints also protected -> 403
    res_get = await client.get("/api/v1/rag/documents")
    assert res_get.status_code == 403


@pytest.mark.asyncio
async def test_rag_ingest_duplicate_and_list(client: AsyncClient) -> None:
    content = (
        "# Resistance Training Volume Guidelines\n\n"
        "Performing 10 to 20 weekly sets per muscle group maximizes hypertrophy "
        "in resistance trained individuals.\n\n"
        "## Rest Intervals\n\n"
        "Resting 2 to 3 minutes between compound sets preserves force production capacity."
    )

    # Ingest document
    res = await client.post(
        "/api/v1/rag/documents",
        headers=ADMIN_HEADERS,
        json={
            "title": "Hypertrophy Volume Guidelines",
            "topic_category": "training",
            "content": content,
            "source_url": "https://example.com/volume",
        },
    )
    assert res.status_code == 202
    data = res.json()
    assert data["status"] == "ingested"
    assert data["chunk_count"] >= 2
    doc_id = data["document_id"]

    # Duplicate content -> 409 Conflict
    res_dup = await client.post(
        "/api/v1/rag/documents",
        headers=ADMIN_HEADERS,
        json={
            "title": "Duplicate Volume Guidelines",
            "topic_category": "training",
            "content": content,
        },
    )
    assert res_dup.status_code == 409

    # List documents
    res_list = await client.get("/api/v1/rag/documents", headers=ADMIN_HEADERS)
    assert res_list.status_code == 200
    docs = res_list.json()
    assert len(docs) == 1
    assert docs[0]["id"] == doc_id
    assert docs[0]["chunk_count"] == data["chunk_count"]

    # Get document detail
    res_detail = await client.get(f"/api/v1/rag/documents/{doc_id}", headers=ADMIN_HEADERS)
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["title"] == "Hypertrophy Volume Guidelines"
    assert detail["chunk_count"] == data["chunk_count"]


@pytest.mark.asyncio
async def test_rag_semantic_search_and_deletion(client: AsyncClient) -> None:
    training_doc = (
        "# Progressive Overload Principles\n\n"
        "Progressive overload involves systematically increasing weight, "
        "repetitions, or volume over time.\n\n"
        "## Squat Programming\n\n"
        "The barbell back squat develops quad and glute strength "
        "when performed through a full range of motion."
    )
    nutrition_doc = (
        "# Protein Synthesis Guidelines\n\n"
        "Consuming 1.6 to 2.2 grams of protein per kilogram of body weight "
        "supports muscle repair.\n\n"
        "## Meal Frequency\n\n"
        "Distributing protein across 3 to 5 meals ensures sustained "
        "elevation of muscle protein synthesis."
    )

    # Ingest training doc
    res1 = await client.post(
        "/api/v1/rag/documents",
        headers=ADMIN_HEADERS,
        json={
            "title": "Overload & Squats",
            "topic_category": "training",
            "content": training_doc,
        },
    )
    assert res1.status_code == 202
    doc1_id = res1.json()["document_id"]

    # Ingest nutrition doc
    res2 = await client.post(
        "/api/v1/rag/documents",
        headers=ADMIN_HEADERS,
        json={
            "title": "Protein & Nutrition",
            "topic_category": "nutrition",
            "content": nutrition_doc,
        },
    )
    assert res2.status_code == 202
    assert res2.json()["document_id"] is not None

    # Search with pgvector cosine similarity
    search_res = await client.post(
        "/api/v1/rag/search",
        headers=ADMIN_HEADERS,
        json={
            "query": "barbell squat progression",
            "topic_category": "training",
            "top_k": 3,
            "threshold": 0.50,
        },
    )
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) >= 1
    assert results[0]["document_id"] == doc1_id
    assert results[0]["similarity_score"] > 0.50

    # High threshold filter out test
    strict_res = await client.post(
        "/api/v1/rag/search",
        headers=ADMIN_HEADERS,
        json={
            "query": "astrophysics quantum tunneling",
            "top_k": 5,
            "threshold": 0.99,
        },
    )
    assert strict_res.status_code == 200
    assert len(strict_res.json()) == 0

    # Delete training document -> cascade chunk deletion
    del_res = await client.delete(f"/api/v1/rag/documents/{doc1_id}", headers=ADMIN_HEADERS)
    assert del_res.status_code == 204

    # Document should not be found
    get_res = await client.get(f"/api/v1/rag/documents/{doc1_id}", headers=ADMIN_HEADERS)
    assert get_res.status_code == 404

    # Search should no longer return chunks from deleted document
    search_after_del = await client.post(
        "/api/v1/rag/search",
        headers=ADMIN_HEADERS,
        json={
            "query": "barbell squat progression",
            "top_k": 3,
            "threshold": 0.50,
        },
    )
    assert search_after_del.status_code == 200
    for r in search_after_del.json():
        assert r["document_id"] != doc1_id
