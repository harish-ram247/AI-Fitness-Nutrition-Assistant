from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.api.dependencies.database import get_db


@pytest.mark.asyncio
async def test_get_db_session_lifecycle() -> None:
    mock_session = AsyncMock()
    mock_context = MagicMock()
    mock_context.__aenter__.return_value = mock_session
    mock_context.__aexit__.return_value = None
    mock_factory = MagicMock(return_value=mock_context)

    with patch("app.api.dependencies.database.AsyncSessionFactory", mock_factory):
        async for session in get_db():
            assert session == mock_session


@pytest.mark.asyncio
async def test_get_db_session_rollback_on_exception() -> None:
    mock_session = AsyncMock()
    mock_context = MagicMock()
    mock_context.__aenter__.return_value = mock_session
    mock_context.__aexit__.return_value = None
    mock_factory = MagicMock(return_value=mock_context)

    with patch("app.api.dependencies.database.AsyncSessionFactory", mock_factory):
        gen = get_db()
        session = await anext(gen)
        assert session == mock_session
        with pytest.raises(ValueError, match="Test Exception"):
            await gen.athrow(ValueError("Test Exception"))

        mock_session.rollback.assert_called_once()
