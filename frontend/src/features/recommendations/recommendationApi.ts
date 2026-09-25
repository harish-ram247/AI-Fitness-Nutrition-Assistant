import { apiClient } from '../../api/client';
import type {
  MealRecommendationParams,
  MealRecommendationResponse,
  WorkoutRecommendationParams,
  WorkoutRecommendationResponse,
} from '../../types/recommendation';

/**
 * Dedicated Recommendation API service matching backend Phase 7B-7D contracts:
 * - GET /api/v1/recommendations/meals
 * - GET /api/v1/recommendations/workouts
 */
export const recommendationApi = {
  /**
   * Get deterministic meal recommendations with optional AI enrichment.
   * GET /api/v1/recommendations/meals
   */
  async getMealRecommendations(
    params?: MealRecommendationParams,
  ): Promise<MealRecommendationResponse> {
    return apiClient.get<MealRecommendationResponse>('/api/v1/recommendations/meals', {
      params: {
        meal_type: params?.meal_type,
        target_calories: params?.target_calories,
        allergies: params?.allergies,
        disliked_foods: params?.disliked_foods,
        limit: params?.limit,
        include_ai: params?.include_ai,
      },
    });
  },

  /**
   * Get deterministic workout recommendations with optional AI enrichment.
   * GET /api/v1/recommendations/workouts
   */
  async getWorkoutRecommendations(
    params?: WorkoutRecommendationParams,
  ): Promise<WorkoutRecommendationResponse> {
    return apiClient.get<WorkoutRecommendationResponse>('/api/v1/recommendations/workouts', {
      params: {
        target_duration_minutes: params?.target_duration_minutes,
        workout_type: params?.workout_type,
        equipment: params?.equipment,
        limit: params?.limit,
        include_ai: params?.include_ai,
      },
    });
  },
};
