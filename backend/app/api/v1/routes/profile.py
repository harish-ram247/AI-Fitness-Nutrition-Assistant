from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies.auth import get_current_user
from app.api.dependencies.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    UserPreferenceRead,
    UserPreferenceUpdate,
    UserProfileRead,
    UserProfileUpdate,
)
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])


def get_profile_service(db: AsyncSession = Depends(get_db)) -> ProfileService:
    return ProfileService(UserRepository(db))


@router.get(
    "",
    response_model=UserProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Get current user fitness profile",
)
async def get_profile(
    current_user: User = Depends(get_current_user),
    profile_service: ProfileService = Depends(get_profile_service),
) -> Any:
    return await profile_service.get_profile(current_user.id)


@router.put(
    "",
    response_model=UserProfileRead,
    status_code=status.HTTP_200_OK,
    summary="Update current user fitness profile",
)
async def update_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    profile_service: ProfileService = Depends(get_profile_service),
) -> Any:
    return await profile_service.update_profile(current_user.id, data)


@router.get(
    "/preferences",
    response_model=UserPreferenceRead,
    status_code=status.HTTP_200_OK,
    summary="Get current user preferences",
)
async def get_preferences(
    current_user: User = Depends(get_current_user),
    profile_service: ProfileService = Depends(get_profile_service),
) -> Any:
    return await profile_service.get_preferences(current_user.id)


@router.patch(
    "/preferences",
    response_model=UserPreferenceRead,
    status_code=status.HTTP_200_OK,
    summary="Update current user preferences",
)
async def update_preferences(
    data: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    profile_service: ProfileService = Depends(get_profile_service),
) -> Any:
    return await profile_service.update_preferences(current_user.id, data)
