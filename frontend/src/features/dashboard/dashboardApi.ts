import { apiClient } from '../../api/client';
import { DailyNutritionSummaryResponse } from '../../types/nutrition';
import { WeightHistoryResponse } from '../../types/progress';
import { WorkoutSessionSummaryResponse } from '../../types/workout';

export const dashboardApi = {
  /**
   * Get daily nutrition summary and meal breakdown.
   * GET /api/v1/nutrition/daily?date=YYYY-MM-DD
   */
  async getDailyNutrition(date: string): Promise<DailyNutritionSummaryResponse> {
    return apiClient.get<DailyNutritionSummaryResponse>('/api/v1/nutrition/daily', {
      params: { date },
    });
  },

  /**
   * Get weight history and trend.
   * GET /api/v1/progress/weight
   */
  async getWeightHistory(fromDate?: string, toDate?: string): Promise<WeightHistoryResponse> {
    return apiClient.get<WeightHistoryResponse>('/api/v1/progress/weight', {
      params: { from: fromDate, to: toDate },
    });
  },

  /**
   * Get recent workouts.
   * GET /api/v1/workouts?page=1&size=3
   */
  async getRecentWorkouts(size = 3): Promise<WorkoutSessionSummaryResponse> {
    return apiClient.get<WorkoutSessionSummaryResponse>('/api/v1/workouts', {
      params: { page: 1, size },
    });
  },
};
