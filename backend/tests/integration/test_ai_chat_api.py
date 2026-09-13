from typing import Any
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts.nutrition_summary import NutritionSummaryLLMOutput
from app.ai.providers.mock import MockLLMProvider
from app.api.dependencies.ai import get_llm_provider
from app.api.dependencies.database import get_db
from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
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


async def get_auth_headers(
    client: AsyncClient, email: str = "chat_user@example.com"
) -> dict[str, str]:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!"},
    )
    tokens = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "Password123!"},
        )
    ).json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}


@pytest.mark.asyncio
async def test_ai_chat_conversation_lifecycle_and_multiturn(
    client: AsyncClient,
) -> None:
    headers = await get_auth_headers(client, "chat_lifecycle@example.com")

    # Ingest a RAG document to provide grounded knowledge
    doc_res = await client.post(
        "/api/v1/rag/documents",
        headers=ADMIN_HEADERS,
        json={
            "title": "Protein and Recovery",
            "topic_category": "nutrition",
            "content": (
                "# Optimal Protein Distribution\n\n"
                "Aim for 0.4 to 0.55g per kg of bodyweight per meal across 4 meals.\n\n"
                "## Leucine Threshold\n\n"
                "Each meal should contain approximately 3 grams of leucine "
                "to trigger muscle protein synthesis."
            ),
        },
    )
    assert doc_res.status_code == 202

    # Turn 1: Start new conversation
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMProvider(
        default_completion=(
            "Consuming 20-40g of protein every 3-4 hours optimizes muscle protein synthesis."
        )
    )

    res1 = await client.post(
        "/api/v1/ai/chat",
        headers=headers,
        json={"message": "What is the optimal protein distribution for recovery?"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    convo_id = data1["conversation_id"]
    assert "optimizes muscle protein synthesis" in data1["response"]
    assert len(data1["sources"]) >= 1
    assert data1["sources"][0]["document_title"] == "Protein and Recovery"

    # Turn 2: Follow up in the same conversation
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMProvider(
        default_completion="Leucine triggers the mTOR pathway to stimulate muscle repair."
    )

    res2 = await client.post(
        "/api/v1/ai/chat",
        headers=headers,
        json={
            "conversation_id": convo_id,
            "message": "Why is leucine specifically mentioned in this context?",
        },
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["conversation_id"] == convo_id
    assert "mTOR pathway" in data2["response"]

    # Verify conversation history via GET /api/v1/ai/conversations/{id}
    detail_res = await client.get(
        f"/api/v1/ai/conversations/{convo_id}",
        headers=headers,
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == convo_id
    # 2 user messages + 2 assistant messages = 4 messages
    assert len(detail["messages"]) == 4

    # List conversations
    list_res = await client.get("/api/v1/ai/conversations", headers=headers)
    assert list_res.status_code == 200
    convo_list = list_res.json()
    assert convo_list["total"] == 1
    assert convo_list["items"][0]["id"] == convo_id

    # Delete conversation
    del_res = await client.delete(f"/api/v1/ai/conversations/{convo_id}", headers=headers)
    assert del_res.status_code == 204

    # Subsequent GET returns 404
    get_after_del = await client.get(f"/api/v1/ai/conversations/{convo_id}", headers=headers)
    assert get_after_del.status_code == 404

    app.dependency_overrides.pop(get_llm_provider, None)


@pytest.mark.asyncio
async def test_ai_conversation_user_isolation(client: AsyncClient) -> None:
    headers_u1 = await get_auth_headers(client, "user1_isolation@example.com")
    headers_u2 = await get_auth_headers(client, "user2_isolation@example.com")

    # User 1 starts conversation
    res1 = await client.post(
        "/api/v1/ai/chat",
        headers=headers_u1,
        json={"message": "User 1 confidential fitness query"},
    )
    assert res1.status_code == 200
    u1_convo_id = res1.json()["conversation_id"]

    # User 2 attempts to GET User 1's conversation -> 404 Not Found
    res_get = await client.get(
        f"/api/v1/ai/conversations/{u1_convo_id}",
        headers=headers_u2,
    )
    assert res_get.status_code == 404

    # User 2 attempts to DELETE User 1's conversation -> 404 Not Found
    res_del = await client.delete(
        f"/api/v1/ai/conversations/{u1_convo_id}",
        headers=headers_u2,
    )
    assert res_del.status_code == 404

    # User 2 attempts to post message to User 1's conversation -> 404 Not Found
    res_post = await client.post(
        "/api/v1/ai/chat",
        headers=headers_u2,
        json={
            "conversation_id": u1_convo_id,
            "message": "User 2 snooping message",
        },
    )
    assert res_post.status_code == 404


@pytest.mark.asyncio
async def test_ai_daily_summary_endpoint(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "summary_user@example.com")

    expected_output = NutritionSummaryLLMOutput(
        summary="Great job maintaining high protein intake today. Caloric intake was balanced.",
        highlights=[
            "High protein target achieved with chicken breast at lunch",
            "Caloric intake remained within maintenance threshold",
        ],
    )
    app.dependency_overrides[get_llm_provider] = lambda: MockLLMProvider(
        structured_response=expected_output
    )

    res = await client.post("/api/v1/ai/summarise-today", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "protein intake" in data["summary"]
    assert len(data["highlights"]) == 2
    assert data["tokens_used"] > 0

    app.dependency_overrides.pop(get_llm_provider, None)


@pytest.mark.asyncio
async def test_ai_provider_service_unavailable_error_handling(client: AsyncClient) -> None:
    headers = await get_auth_headers(client, "service_down_user@example.com")

    failing_provider = AsyncMock()
    failing_provider.complete.side_effect = ServiceUnavailableError(
        "OpenAI API upstream gateway timeout"
    )
    app.dependency_overrides[get_llm_provider] = lambda: failing_provider

    res = await client.post(
        "/api/v1/ai/chat",
        headers=headers,
        json={"message": "Will this fail gracefully?"},
    )
    assert res.status_code == 503
    assert "SERVICE_UNAVAILABLE" in res.json()["error"]["code"]

    app.dependency_overrides.pop(get_llm_provider, None)
