# AI-Powered Personalized Fitness & Nutrition Assistant

A production-quality portfolio project demonstrating full-stack development, REST API design, database design, authentication, AI integration, LLM orchestration, RAG, embeddings, vector search, personalization, testing, security, and system design.

---

## Documentation

All architecture and design documentation is in [`docs/`](./docs/).

| Document | Description |
|----------|-------------|
| [requirements.md](./docs/requirements.md) | Functional, non-functional, AI, RAG, and security requirements |
| [architecture.md](./docs/architecture.md) | System architecture, module boundaries, data flows |
| [fastapi-architecture.md](./docs/fastapi-architecture.md) | FastAPI backend structure and layer design |
| [database-design.md](./docs/database-design.md) | PostgreSQL schema, ER diagram, indexing strategy |
| [api-design.md](./docs/api-design.md) | REST API endpoint specifications |
| [ai-architecture.md](./docs/ai-architecture.md) | AI orchestration, prompt design, context management |
| [rag-architecture.md](./docs/rag-architecture.md) | RAG pipeline, chunking, retrieval, citations |
| [security.md](./docs/security.md) | Auth, JWT, prompt injection, AI safety |
| [testing-strategy.md](./docs/testing-strategy.md) | Testing approach for all layers including AI/RAG |
| [development-roadmap.md](./docs/development-roadmap.md) | Phased implementation plan |
| [architecture-decisions.md](./docs/architecture-decisions.md) | Architecture Decision Records (ADRs) |

---

## Project Status

**Phase 1 — Project Foundation & Backend Infrastructure (Complete).**

Infrastructure established:
- FastAPI modular monolith application bootstrap
- Async SQLAlchemy 2.x + `asyncpg` PostgreSQL database layer
- Pydantic v2 typed environment settings configuration
- Request ID & timing middleware
- Centralized exception handling infrastructure
- Generic base repository abstraction
- Health check API (`GET /api/v1/health`) with async database ping
- Alembic async database migration framework
- Automated test suite (`pytest` + `pytest-asyncio`)
- Code quality tooling (`ruff`, `mypy`)
- Docker Compose development infrastructure (PostgreSQL 16 + pgvector)

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.11+ / FastAPI |
| Database | PostgreSQL 16 |
| Vector Extension | pgvector (prepared in Docker) |
| ORM | SQLAlchemy 2.x (async) + asyncpg |
| Migrations | Alembic (async) |
| Settings | Pydantic v2 / pydantic-settings |
| Testing | pytest, pytest-asyncio, httpx |
| Lint & Format | Ruff |
| Type Check | Mypy |
| Containerization | Docker Compose |

---

## Project Structure

```text
backend/
├── app/
│   ├── api/
│   │   ├── dependencies/
│   │   │   └── database.py        # get_db async session generator
│   │   └── v1/
│   │       ├── router.py          # /api/v1 router aggregator
│   │       └── routes/
│   │           └── health.py      # GET /api/v1/health
│   ├── core/
│   │   ├── config.py              # Pydantic Settings
│   │   ├── exceptions.py          # Exception hierarchy & handlers
│   │   └── middleware.py          # X-Request-ID & timing middleware
│   ├── db/
│   │   ├── base.py                # SQLAlchemy DeclarativeBase
│   │   └── session.py             # Async engine & sessionmaker
│   ├── repositories/
│   │   └── base.py                # BaseRepository generic interface
│   └── main.py                    # FastAPI application entry point
├── tests/
│   ├── conftest.py                # Pytest fixtures (async client, mock db)
│   ├── unit/
│   │   └── test_config.py         # Settings unit tests
│   └── integration/
│       ├── test_health.py         # Health endpoint tests
│       └── test_database.py       # Async DB session lifecycle tests
├── alembic/                       # Migration environment
├── alembic.ini                    # Alembic configuration
├── pyproject.toml                 # Dependencies & tool configuration
└── Dockerfile                     # Container definition
```

---

## Quick Start (Local Setup)

### Prerequisites
- Python 3.11+
- PostgreSQL 16 (or Docker Compose)

### 1. Environment Setup

```bash
# Copy environment variable template
cp .env.example .env

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install backend dependencies in editable mode
cd backend
pip install -e ".[dev]"
```

### 2. Start PostgreSQL via Docker Compose

```bash
# From project root
docker-compose up db -d
```

### 3. Run Backend Server

```bash
cd backend
uvicorn app.main:app --reload
```

- Health Check Endpoint: `http://localhost:8000/api/v1/health`
- OpenAPI Swagger Docs: `http://localhost:8000/docs`

---

## Testing & Verification

```bash
# Run pytest test suite
cd backend
pytest -v

# Run linter
ruff check .

# Run static type checker
mypy app
```

---

## Database Migrations (Alembic)

```bash
cd backend

# Run pending migrations
alembic upgrade head

# Generate a new migration revision
alembic revision --autogenerate -m "migration description"
```
