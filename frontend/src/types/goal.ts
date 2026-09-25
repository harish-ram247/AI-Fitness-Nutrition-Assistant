/**
 * Fitness Goal TypeScript definitions mapped directly from backend:
 * backend/app/schemas/goal.py
 * backend/app/models/goal.py
 */

export type GoalStatus = 'active' | 'completed' | 'abandoned';

export const GOAL_TYPE_PRESETS: { value: string; label: string; defaultUnit: string }[] = [
  { value: 'weight_loss', label: 'Weight Loss', defaultUnit: 'kg' },
  { value: 'muscle_gain', label: 'Muscle Gain', defaultUnit: 'kg' },
  { value: 'maintenance', label: 'Maintenance', defaultUnit: 'kcal' },
  { value: 'strength', label: 'Strength', defaultUnit: 'kg' },
  { value: 'endurance', label: 'Endurance', defaultUnit: 'km' },
  { value: 'workout_frequency', label: 'Workout Frequency', defaultUnit: 'sessions/week' },
  { value: 'water_intake', label: 'Water Intake', defaultUnit: 'L' },
];

export interface FitnessGoalRead {
  id: string; // UUID
  user_id: string; // UUID
  goal_type: string;
  description: string | null;
  target_value: number | string | null;
  target_unit: string | null;
  target_date: string | null; // YYYY-MM-DD
  status: string; // 'active' | 'completed' | 'abandoned'
  completed_at: string | null; // ISO timestamp
  created_at: string;
  updated_at: string;
}

export interface FitnessGoalCreate {
  goal_type: string;
  description?: string | null;
  target_value?: number | string | null;
  target_unit?: string | null;
  target_date?: string | null;
}

export interface FitnessGoalUpdate {
  goal_type?: string | null;
  description?: string | null;
  target_value?: number | string | null;
  target_unit?: string | null;
  target_date?: string | null;
  status?: string | null;
}

export interface FitnessGoalListResponse {
  items: FitnessGoalRead[];
  total: number;
}
