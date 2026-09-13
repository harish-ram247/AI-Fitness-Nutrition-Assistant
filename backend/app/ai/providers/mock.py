import hashlib
import math
import re
from typing import Any, TypeVar

from pydantic import BaseModel

from app.ai.providers.base import AbstractEmbedder, AbstractLLMProvider, LLMResponse, Message

T = TypeVar("T", bound=BaseModel)


class MockLLMProvider(AbstractLLMProvider):
    """Deterministic Mock LLM Provider for testing and offline execution."""

    def __init__(
        self,
        default_completion: str | None = None,
        structured_response: Any | None = None,
    ) -> None:
        self.default_completion = default_completion
        self.structured_response = structured_response
        self.calls: list[list[Message]] = []

    async def complete(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> LLMResponse:
        self.calls.append(messages)
        if self.default_completion is not None:
            content = self.default_completion
        else:
            last_message = messages[-1].content if messages else ""
            if "summarise" in last_message.lower() or "summary" in last_message.lower():
                content = (
                    "You have consumed 1,850 kcal today (84% of your daily target)."
                    " Protein intake is well-aligned with your hypertrophy goals."
                )
            elif "protein" in last_message.lower():
                content = (
                    "Dietary protein is essential post-workout for muscle protein synthesis"
                    " and tissue repair. According to the reference guide, aim for 1.6 to 2.2g"
                    " per kg of body weight."
                )
            else:
                content = "This is a grounded response from the assistant."

        return LLMResponse(
            content=content,
            prompt_tokens=150,
            completion_tokens=45,
            model="mock-gpt-4o-mini",
            finish_reason="stop",
        )

    async def structured_completion(
        self,
        messages: list[Message],
        response_model: type[T],
        temperature: float = 0.1,
    ) -> T:
        self.calls.append(messages)
        if self.structured_response is not None:
            if isinstance(self.structured_response, response_model):
                return self.structured_response
            if isinstance(self.structured_response, dict):
                return response_model.model_validate(self.structured_response)

        # Default fallback for food extraction schema if not preset
        last_message = messages[-1].content if messages else ""
        # Check if caller expects ExtractedFoodList or similar
        data: dict[str, Any] = {}
        if "items" in response_model.model_fields:
            # Typical food extraction schema: ExtractedFoodList(items=[ExtractedFoodItem(...)])
            # Parse simple words like "eggs", "chicken", "oatmeal"
            items = []
            lower_msg = last_message.lower()
            if "egg" in lower_msg:
                items.append(
                    {
                        "extracted_text": "3 scrambled eggs",
                        "food_name": "Egg, scrambled",
                        "quantity": 3.0,
                        "unit": "large",
                    }
                )
            if "toast" in lower_msg or "bread" in lower_msg:
                items.append(
                    {
                        "extracted_text": "2 slices of wholegrain toast",
                        "food_name": "Bread, whole-wheat",
                        "quantity": 2.0,
                        "unit": "slice",
                    }
                )
            if "oat" in lower_msg:
                items.append(
                    {
                        "extracted_text": "100g oatmeal",
                        "food_name": "Oatmeal",
                        "quantity": 100.0,
                        "unit": "g",
                    }
                )
            if not items:
                items.append(
                    {
                        "extracted_text": last_message,
                        "food_name": "Generic Food",
                        "quantity": 100.0,
                        "unit": "g",
                    }
                )
            data = {"items": items}

        return response_model.model_validate(data)


class MockEmbedder(AbstractEmbedder):
    """Deterministic Mock Embedder producing reproducible 1536-dim unit vectors."""

    @property
    def dimension(self) -> int:
        return 1536

    STOP_WORDS = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "has",
        "he",
        "in",
        "is",
        "it",
        "its",
        "of",
        "on",
        "that",
        "the",
        "to",
        "was",
        "were",
        "will",
        "with",
        "what",
        "aim",
        "across",
        "per",
        "each",
        "should",
        "can",
        "you",
    }

    def _stem(self, word: str) -> str:
        for sfx in ("ing", "ion", "ions", "ive", "ed", "es", "s"):
            if word.endswith(sfx) and len(word) > len(sfx) + 2:
                return word[: -len(sfx)]
        return word

    def _generate_vector(self, text: str) -> list[float]:
        vec = [0.0] * self.dimension
        lines = text.split("\n")
        total_tokens = 0
        for line_idx, line in enumerate(lines):
            weight = 2.5 if line_idx == 0 or line.startswith("#") else 1.0
            words = [
                w for w in re.findall(r"[a-zA-Z]{3,}", line.lower()) if w not in self.STOP_WORDS
            ]
            tokens = [self._stem(w) for w in words]
            for token in tokens:
                total_tokens += 1
                h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
                for j in range(16):
                    idx = (h >> (j * 4)) % self.dimension
                    vec[idx] += weight

        if total_tokens == 0:
            vec[0] = 1.0
            return vec

        # Normalize to unit vector for cosine similarity
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [round(v / norm, 6) for v in vec]
        else:
            vec[0] = 1.0

        return vec

    async def embed_query(self, text: str) -> list[float]:
        return self._generate_vector(text)

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._generate_vector(t) for t in texts]
