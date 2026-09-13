import pytest

from app.core.config import Settings


def test_default_settings() -> None:
    settings = Settings()
    assert settings.APP_ENV == "development"
    assert settings.DEBUG is True
    assert "postgresql+asyncpg" in settings.DATABASE_URL
    assert isinstance(settings.CORS_ORIGINS, list)


def test_assemble_cors_origins_string() -> None:
    origins_str = "http://localhost:3000, http://localhost:5173 "
    parsed = Settings.assemble_cors_origins(origins_str)
    assert parsed == ["http://localhost:3000", "http://localhost:5173"]


def test_assemble_cors_origins_json() -> None:
    origins_json = '["http://localhost:3000", "http://localhost:5173"]'
    parsed = Settings.assemble_cors_origins(origins_json)
    assert parsed == ["http://localhost:3000", "http://localhost:5173"]


def test_assemble_cors_origins_list() -> None:
    origins_list = ["http://example.com", "http://test.com"]
    parsed = Settings.assemble_cors_origins(origins_list)
    assert parsed == ["http://example.com", "http://test.com"]


def test_custom_environment_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+asyncpg://user:pass@db:5432/prod_db"
    )
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com")

    settings = Settings()
    assert settings.APP_ENV == "production"
    assert settings.DEBUG is False
    assert settings.DATABASE_URL == "postgresql+asyncpg://user:pass@db:5432/prod_db"
    assert settings.CORS_ORIGINS == ["https://app.example.com"]
