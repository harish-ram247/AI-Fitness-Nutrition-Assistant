import json
from typing import TypeVar

from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from pydantic import BaseModel

from app.ai.providers.base import AbstractEmbedder, AbstractLLMProvider, LLMResponse, Message
from app.core.exceptions import ServiceUnavailableError

T = TypeVar("T", bound=BaseModel)


class OpenAIProvider(AbstractLLMProvider):
    """OpenAI API implementation of the LLM provider interface."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini") -> None:
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def complete(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> LLMResponse:
        try:
            formatted_messages = [{"role": m.role, "content": m.content} for m in messages]
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=formatted_messages,  # type: ignore[arg-type]
                temperature=temperature,
                max_tokens=max_tokens,
            )
            choice = response.choices[0]
            usage = response.usage
            return LLMResponse(
                content=choice.message.content or "",
                prompt_tokens=usage.prompt_tokens if usage else 0,
                completion_tokens=usage.completion_tokens if usage else 0,
                model=response.model,
                finish_reason=choice.finish_reason or "stop",
            )
        except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
            raise ServiceUnavailableError(f"LLM provider error: {exc}") from exc

    async def structured_completion(
        self,
        messages: list[Message],
        response_model: type[T],
        temperature: float = 0.1,
    ) -> T:
        try:
            formatted_messages = [{"role": m.role, "content": m.content} for m in messages]
            # Use beta.chat.completions.parse for strict structured outputs
            completion = await self.client.beta.chat.completions.parse(
                model=self.model,
                messages=formatted_messages,  # type: ignore[arg-type]
                response_format=response_model,
                temperature=temperature,
            )
            parsed = completion.choices[0].message.parsed
            if parsed is None:
                content = completion.choices[0].message.content or "{}"
                return response_model.model_validate(json.loads(content))
            return parsed
        except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
            raise ServiceUnavailableError(f"LLM provider error: {exc}") from exc


class OpenAIEmbedder(AbstractEmbedder):
    """OpenAI API implementation of the Embedder interface."""

    def __init__(self, api_key: str, model: str = "text-embedding-3-small") -> None:
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    @property
    def dimension(self) -> int:
        return 1536

    async def embed_query(self, text: str) -> list[float]:
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=text,
            )
            return response.data[0].embedding
        except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
            raise ServiceUnavailableError(f"Embedding provider error: {exc}") from exc

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=texts,
            )
            # Sort by index to maintain ordering
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]
        except (RateLimitError, APITimeoutError, APIConnectionError, APIStatusError) as exc:
            raise ServiceUnavailableError(f"Embedding provider error: {exc}") from exc
