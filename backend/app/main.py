from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestIDMiddleware
from app.db.session import dispose_engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await dispose_engine()


def create_application() -> FastAPI:
    application = FastAPI(
        title="AI Fitness & Nutrition Assistant API",
        version="1.0.0",
        description="Backend API for AI-Powered Personalized Fitness & Nutrition Platform",
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
    )

    # CORS Middleware
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Request ID and Timing Middleware
    application.add_middleware(RequestIDMiddleware)

    # Register Exception Handlers
    register_exception_handlers(application)

    # Register V1 API Router
    application.include_router(api_v1_router, prefix="/api/v1")

    return application


app = create_application()
