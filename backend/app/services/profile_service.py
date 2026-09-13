import uuid

from fastapi import HTTPException, status

from app.models.user import UserPreference, UserProfile
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserPreferenceUpdate, UserProfileUpdate


class ProfileService:
    def __init__(self, user_repo: UserRepository) -> None:
        self.user_repo = user_repo

    async def get_profile(self, user_id: uuid.UUID) -> UserProfile:
        profile = await self.user_repo.get_profile(user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )
        return profile

    async def update_profile(
        self, user_id: uuid.UUID, data: UserProfileUpdate
    ) -> UserProfile:
        profile = await self.user_repo.get_profile(user_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found",
            )

        profile.first_name = data.first_name
        profile.last_name = data.last_name
        profile.date_of_birth = data.date_of_birth
        profile.sex = data.sex
        profile.height_cm = data.height_cm
        profile.activity_level = data.activity_level
        # Critical ADR-014 constraint: current_weight_kg is never mutated here.

        await self.user_repo.commit()
        await self.user_repo.session.refresh(profile)
        return profile

    async def get_preferences(self, user_id: uuid.UUID) -> UserPreference:
        preferences = await self.user_repo.get_preferences(user_id)
        if not preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preferences not found",
            )
        return preferences

    async def update_preferences(
        self, user_id: uuid.UUID, data: UserPreferenceUpdate
    ) -> UserPreference:
        preferences = await self.user_repo.get_preferences(user_id)
        if not preferences:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Preferences not found",
            )

        if data.unit_system is not None:
            preferences.unit_system = data.unit_system
        if data.calorie_target is not None:
            preferences.calorie_target = data.calorie_target
        if data.protein_target_g is not None:
            preferences.protein_target_g = data.protein_target_g
        if data.carbs_target_g is not None:
            preferences.carbs_target_g = data.carbs_target_g
        if data.fat_target_g is not None:
            preferences.fat_target_g = data.fat_target_g
        if data.dietary_restrictions is not None:
            preferences.dietary_restrictions = data.dietary_restrictions
        if data.ai_persona is not None:
            preferences.ai_persona = data.ai_persona

        await self.user_repo.commit()
        await self.user_repo.session.refresh(preferences)
        return preferences
