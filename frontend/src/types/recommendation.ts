/**
 * Recommendation Types matching backend Phase 7B, 7C, and 7D schemas.
 * Authoritative backend schemas: backend/app/schemas/recommendation.py
 */

export const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof VALID_MEAL_TYPES)[number];

export type RecommendationWorkoutType =
  | 'full_body'
  | 'upper_body'
  | 'lower_body'
  | 'push'
  | 'pull'
  | 'cardio'
  | 'mobility';

export const VALID_WORKOUT_TYPES: readonly RecommendationWorkoutType[] = [
  'full_body',
  'upper_body',
  'lower_body',
  'push',
  'pull',
  'cardio',
  'mobility',
] as const;

export const WORKOUT_TYPE_LABELS: Record<RecommendationWorkoutType, string> = {
  full_body: 'Full Body',
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  push: 'Push',
  pull: 'Pull',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

export interface MealComponentResponse {
  food_id: string;
  food_name: string;
  quantity_g: number;
  serving_id: string | null;
  serving_description: string;
  serving_count: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface FactorScoreResponse {
  factor_name: string;
  normalized_score: number;
  weight: number;
  weighted_contribution: number;
  reason: string | null;
}

export interface MealRecommendationItem {
  id: string;
  name: string;
  meal_type: string;
  components: MealComponentResponse[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  score: number;
  reasons: string[];
  factor_scores: FactorScoreResponse[];
  ai_explanation: string | null;
  ai_rank: number | null;
}

export interface MealRecommendationResponse {
  recommendation_type: string;
  meal_type: string;
  target_calories: number | null;
  target_protein_g: number | null;
  remaining_daily_calories: number | null;
  items: MealRecommendationItem[];
  total_generated: number;
  total_survived_filtering: number;
  disclaimer: string;
  metadata: Record<string, unknown>;
  ai_used: boolean;
  ai_fallback: boolean;
  ai_summary: string | null;
  ai_considerations: string[];
}

export interface WorkoutExerciseResponse {
  exercise_id: string;
  exercise_name: string;
  category: string;
  muscle_groups: string[];
  equipment: string | null;
  order_index: number;
  recommended_sets: number;
  recommended_reps: number | null;
  recommended_duration_seconds: number | null;
  recommended_rest_seconds: number;
}

export interface WorkoutRecommendationItem {
  id: string;
  name: string;
  workout_type: string;
  category: string;
  target_muscle_groups: string[];
  estimated_duration_minutes: number;
  total_sets: number;
  primary_equipment_needed: string[];
  variant: string;
  score: number;
  reasons: string[];
  factor_scores: FactorScoreResponse[];
  exercises: WorkoutExerciseResponse[];
  ai_explanation: string | null;
  ai_rank: number | null;
}

export interface WorkoutRecommendationResponse {
  recommendation_type: string;
  target_duration_minutes: number;
  workout_type: string | null;
  items: WorkoutRecommendationItem[];
  total_generated: number;
  total_survived_filtering: number;
  disclaimer: string;
  metadata: Record<string, unknown>;
  ai_used: boolean;
  ai_fallback: boolean;
  ai_summary: string | null;
  ai_considerations: string[];
}

export interface MealRecommendationParams {
  meal_type?: string;
  target_calories?: number;
  allergies?: string[];
  disliked_foods?: string[];
  limit?: number;
  include_ai?: boolean;
}

export interface WorkoutRecommendationParams {
  target_duration_minutes?: number;
  workout_type?: RecommendationWorkoutType;
  equipment?: string[];
  limit?: number;
  include_ai?: boolean;
}
