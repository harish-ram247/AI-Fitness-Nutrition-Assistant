import { apiClient } from '../../api/client';
import type { UserProfileRead, UserProfileUpdate } from '../../types/profile';
import type { UserPreferenceRead, UserPreferenceUpdate } from '../../types/preferences';
import type {
  FitnessGoalCreate,
  FitnessGoalListResponse,
  FitnessGoalRead,
  FitnessGoalUpdate,
} from '../../types/goal';

/**
 * Profile & Goals API service matching FastAPI contracts:
 * - /api/v1/profile
 * - /api/v1/profile/preferences
 * - /api/v1/goals
 */
export const profileApi = {
  /**
   * Fetch current user fitness profile.
   * GET /api/v1/profile
   */
  async getProfile(): Promise<UserProfileRead> {
    return apiClient.get<UserProfileRead>('/api/v1/profile');
  },

  /**
   * Update current user fitness profile.
   * PUT /api/v1/profile
   */
  async updateProfile(data: UserProfileUpdate): Promise<UserProfileRead> {
    return apiClient.put<UserProfileRead>('/api/v1/profile', data);
  },

  /**
   * Fetch current user preferences.
   * GET /api/v1/profile/preferences
   */
  async getPreferences(): Promise<UserPreferenceRead> {
    return apiClient.get<UserPreferenceRead>('/api/v1/profile/preferences');
  },

  /**
   * Update current user preferences.
   * PATCH /api/v1/profile/preferences
   */
  async updatePreferences(data: UserPreferenceUpdate): Promise<UserPreferenceRead> {
    return apiClient.patch<UserPreferenceRead>('/api/v1/profile/preferences', data);
  },

  /**
   * List current user fitness goals, optionally filtered by status (active/completed/abandoned).
   * GET /api/v1/goals?status=...
   */
  async listGoals(status?: string): Promise<FitnessGoalListResponse> {
    const params = status ? { status } : undefined;
    return apiClient.get<FitnessGoalListResponse>('/api/v1/goals', { params });
  },

  /**
   * Create a new fitness goal.
   * POST /api/v1/goals
   */
  async createGoal(data: FitnessGoalCreate): Promise<FitnessGoalRead> {
    return apiClient.post<FitnessGoalRead>('/api/v1/goals', data);
  },

  /**
   * Update an existing fitness goal.
   * PATCH /api/v1/goals/{goal_id}
   */
  async updateGoal(goalId: string, data: FitnessGoalUpdate): Promise<FitnessGoalRead> {
    return apiClient.patch<FitnessGoalRead>(`/api/v1/goals/${goalId}`, data);
  },

  /**
   * Delete a fitness goal.
   * DELETE /api/v1/goals/{goal_id} -> 204 No Content
   */
  async deleteGoal(goalId: string): Promise<void> {
    await apiClient.delete<void>(`/api/v1/goals/${goalId}`);
  },
};
