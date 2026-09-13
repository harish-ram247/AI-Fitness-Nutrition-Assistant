from fastapi import APIRouter

from app.api.v1.routes import (
    ai,
    auth,
    exercises,
    foods,
    goals,
    health,
    nutrition,
    profile,
    progress,
    rag,
    users,
    workouts,
)

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(profile.router)
api_v1_router.include_router(goals.router)
api_v1_router.include_router(progress.router)
api_v1_router.include_router(foods.router)
api_v1_router.include_router(nutrition.router)
api_v1_router.include_router(exercises.router)
api_v1_router.include_router(workouts.router)
api_v1_router.include_router(ai.router)
api_v1_router.include_router(rag.router)
