import math

import pytest
from pydantic import BaseModel

from app.ai.providers.base import Message
from app.ai.providers.mock import MockEmbedder, MockLLMProvider


class SampleStructuredOutput(BaseModel):
    summary: str
    score: int


@pytest.mark.asyncio
async def test_mock_llm_provider_complete() -> None:
    provider = MockLLMProvider(default_completion="Hello from test assistant")
    messages = [Message(role="user", content="Hello")]
    response = await provider.complete(messages)

    assert response.content == "Hello from test assistant"
    assert response.model == "mock-gpt-4o-mini"
    assert response.prompt_tokens > 0
    assert response.completion_tokens > 0
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_mock_llm_provider_structured_completion() -> None:
    expected = SampleStructuredOutput(summary="Test summary", score=95)
    provider = MockLLMProvider(structured_response=expected)

    messages = [Message(role="user", content="Score this test")]
    result = await provider.structured_completion(
        messages=messages,
        response_model=SampleStructuredOutput,
    )

    assert result.summary == "Test summary"
    assert result.score == 95


@pytest.mark.asyncio
async def test_mock_embedder_dimension_and_normalization() -> None:
    embedder = MockEmbedder()
    assert embedder.dimension == 1536

    vec = await embedder.embed_query("Principles of strength training and progressive overload")
    assert len(vec) == 1536

    # Verify unit vector (L2 norm = 1.0)
    norm = math.sqrt(sum(x * x for x in vec))
    assert pytest.approx(norm, rel=1e-3) == 1.0


@pytest.mark.asyncio
async def test_mock_embedder_deterministic_similarity() -> None:
    embedder = MockEmbedder()

    # Identical texts yield identical vectors
    vec1 = await embedder.embed_query("Protein intake for muscle growth")
    vec2 = await embedder.embed_query("Protein intake for muscle growth")
    assert vec1 == vec2

    # Related texts have higher cosine similarity than unrelated texts
    doc_vec = await embedder.embed_query(
        "Optimal dietary protein requirements for resistance trained athletes"
    )
    unrelated_vec = await embedder.embed_query(
        "Planetary orbits in astrophysics and solar mechanics"
    )

    def dot_product(a: list[float], b: list[float]) -> float:
        return sum(x * y for x, y in zip(a, b, strict=False))

    sim_related = dot_product(vec1, doc_vec)
    sim_unrelated = dot_product(vec1, unrelated_vec)

    assert sim_related > sim_unrelated
