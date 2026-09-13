from abc import ABC, abstractmethod
from typing import Literal, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T", bound=BaseModel)


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["system", "user", "assistant"]
    content: str


class LLMResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    model: str = "mock-model"
    finish_reason: str = "stop"


class AbstractLLMProvider(ABC):
    """Abstract interface for LLM completion and structured extraction providers."""

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> LLMResponse:
        """Generate a text completion from a list of messages."""
        pass

    @abstractmethod
    async def structured_completion(
        self,
        messages: list[Message],
        response_model: type[T],
        temperature: float = 0.1,
    ) -> T:
        """Generate a structured response adhering strictly to the given Pydantic model."""
        pass


class AbstractEmbedder(ABC):
    """Abstract interface for dense vector embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector dimensions produced by this embedder (e.g. 1536)."""
        pass

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Embed a single search query text into a vector."""
        pass

    @abstractmethod
    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of document chunk texts into vectors."""
        pass
