import { apiClient } from '../../api/client';
import type {
  ExerciseCreate,
  ExerciseRead,
  ExerciseSearchParams,
  ExerciseSearchResponse,
  ExerciseUpdate,
} from '../../types/exercise';
import type {
  WorkoutExerciseCreate,
  WorkoutExerciseRead,
  WorkoutExerciseUpdate,
  WorkoutSearchParams,
  WorkoutSessionCreate,
  WorkoutSessionRead,
  WorkoutSessionSummaryResponse,
  WorkoutSessionUpdate,
  WorkoutSetCreate,
  WorkoutSetRead,
  WorkoutSetUpdate,
} from '../../types/workout';

/**
 * Dedicated Workout & Exercise Catalog API service matching FastAPI contracts:
 * - /api/v1/exercises
 * - /api/v1/workouts
 */
export const workoutApi = {
  // ==========================================
  // EXERCISES
  // ==========================================

  /**
   * Search exercises with filtering and pagination.
   * GET /api/v1/exercises
   */
  async listExercises(params?: ExerciseSearchParams): Promise<ExerciseSearchResponse> {
    return apiClient.get<ExerciseSearchResponse>('/api/v1/exercises', {
      params: {
        q: params?.q,
        category: params?.category,
        muscle_group: params?.muscle_group,
        page: params?.page,
        size: params?.size,
      },
    });
  },

  /**
   * Get exercise details.
   * GET /api/v1/exercises/{exercise_id}
   */
  async getExercise(exerciseId: string): Promise<ExerciseRead> {
    return apiClient.get<ExerciseRead>(`/api/v1/exercises/${exerciseId}`);
  },

  /**
   * Create a custom exercise.
   * POST /api/v1/exercises
   */
  async createExercise(data: ExerciseCreate): Promise<ExerciseRead> {
    return apiClient.post<ExerciseRead>('/api/v1/exercises', data);
  },

  /**
   * Update a custom exercise (owner only).
   * PATCH /api/v1/exercises/{exercise_id}
   */
  async updateExercise(exerciseId: string, data: ExerciseUpdate): Promise<ExerciseRead> {
    return apiClient.patch<ExerciseRead>(`/api/v1/exercises/${exerciseId}`, data);
  },

  /**
   * Delete a custom exercise (owner only).
   * DELETE /api/v1/exercises/{exercise_id}
   */
  async deleteExercise(exerciseId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/exercises/${exerciseId}`);
  },

  // ==========================================
  // WORKOUT SESSIONS
  // ==========================================

  /**
   * Get paginated workout history with optional date filtering.
   * GET /api/v1/workouts
   */
  async listWorkouts(params?: WorkoutSearchParams): Promise<WorkoutSessionSummaryResponse> {
    return apiClient.get<WorkoutSessionSummaryResponse>('/api/v1/workouts', {
      params: {
        from_date: params?.from_date,
        to_date: params?.to_date,
        page: params?.page,
        size: params?.size,
      },
    });
  },

  /**
   * Get full workout session details including exercises and sets.
   * GET /api/v1/workouts/{workout_id}
   */
  async getWorkout(workoutId: string): Promise<WorkoutSessionRead> {
    return apiClient.get<WorkoutSessionRead>(`/api/v1/workouts/${workoutId}`);
  },

  /**
   * Create a workout session (standalone or nested).
   * POST /api/v1/workouts
   */
  async createWorkout(data: WorkoutSessionCreate): Promise<WorkoutSessionRead> {
    return apiClient.post<WorkoutSessionRead>('/api/v1/workouts', data);
  },

  /**
   * Update workout session metadata or timestamps.
   * PATCH /api/v1/workouts/{workout_id}
   */
  async updateWorkout(workoutId: string, data: WorkoutSessionUpdate): Promise<WorkoutSessionRead> {
    return apiClient.patch<WorkoutSessionRead>(`/api/v1/workouts/${workoutId}`, data);
  },

  /**
   * Delete a workout session.
   * DELETE /api/v1/workouts/{workout_id}
   */
  async deleteWorkout(workoutId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/workouts/${workoutId}`);
  },

  // ==========================================
  // WORKOUT EXERCISES
  // ==========================================

  /**
   * Add an exercise (and optional sets) to a workout session.
   * POST /api/v1/workouts/{workout_id}/exercises
   */
  async addWorkoutExercise(
    workoutId: string,
    data: WorkoutExerciseCreate,
  ): Promise<WorkoutExerciseRead> {
    return apiClient.post<WorkoutExerciseRead>(`/api/v1/workouts/${workoutId}/exercises`, data);
  },

  /**
   * Update an exercise entry in a workout session.
   * PATCH /api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}
   */
  async updateWorkoutExercise(
    workoutId: string,
    exerciseEntryId: string,
    data: WorkoutExerciseUpdate,
  ): Promise<WorkoutExerciseRead> {
    return apiClient.patch<WorkoutExerciseRead>(
      `/api/v1/workouts/${workoutId}/exercises/${exerciseEntryId}`,
      data,
    );
  },

  /**
   * Remove an exercise from a workout session.
   * DELETE /api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}
   */
  async deleteWorkoutExercise(workoutId: string, exerciseEntryId: string): Promise<void> {
    return apiClient.delete<void>(`/api/v1/workouts/${workoutId}/exercises/${exerciseEntryId}`);
  },

  // ==========================================
  // WORKOUT SETS
  // ==========================================

  /**
   * Add a set to an exercise entry in a workout session.
   * POST /api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets
   */
  async addWorkoutSet(
    workoutId: string,
    exerciseEntryId: string,
    data: WorkoutSetCreate,
  ): Promise<WorkoutSetRead> {
    return apiClient.post<WorkoutSetRead>(
      `/api/v1/workouts/${workoutId}/exercises/${exerciseEntryId}/sets`,
      data,
    );
  },

  /**
   * Update a set in an exercise entry.
   * PATCH /api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}
   */
  async updateWorkoutSet(
    workoutId: string,
    exerciseEntryId: string,
    setId: string,
    data: WorkoutSetUpdate,
  ): Promise<WorkoutSetRead> {
    return apiClient.patch<WorkoutSetRead>(
      `/api/v1/workouts/${workoutId}/exercises/${exerciseEntryId}/sets/${setId}`,
      data,
    );
  },

  /**
   * Delete a set from an exercise entry.
   * DELETE /api/v1/workouts/{workout_id}/exercises/{exercise_entry_id}/sets/{set_id}
   */
  async deleteWorkoutSet(
    workoutId: string,
    exerciseEntryId: string,
    setId: string,
  ): Promise<void> {
    return apiClient.delete<void>(
      `/api/v1/workouts/${workoutId}/exercises/${exerciseEntryId}/sets/${setId}`,
    );
  },
};
