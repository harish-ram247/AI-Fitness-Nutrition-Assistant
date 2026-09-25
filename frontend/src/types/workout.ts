/**
 * TypeScript definitions mapped directly from backend Pydantic schemas:
 * backend/app/schemas/workout.py
 */

import type { ExerciseRead } from './exercise';

export const VALID_SET_TYPES = ['warmup', 'working', 'drop_set', 'failure'] as const;
export type SetType = (typeof VALID_SET_TYPES)[number];

export const SET_TYPE_LABELS: Record<string, string> = {
  warmup: 'Warm-up',
  working: 'Working',
  drop_set: 'Drop Set',
  failure: 'Failure',
};

export interface WorkoutSetRead {
  id: string; // UUID
  workout_exercise_id: string; // UUID
  set_number: number;
  set_type: string;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  rpe?: number | null;
  completed: boolean;
  created_at: string;
}

export interface WorkoutSetCreate {
  set_number: number;
  set_type?: string;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  rpe?: number | null;
  completed?: boolean;
}

export interface WorkoutSetUpdate {
  set_number?: number;
  set_type?: string;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
  distance_m?: number | null;
  rpe?: number | null;
  completed?: boolean;
}

export interface WorkoutExerciseRead {
  id: string; // UUID
  workout_session_id: string; // UUID
  exercise_id: string; // UUID
  order_index: number;
  notes?: string | null;
  exercise?: ExerciseRead | null;
  sets: WorkoutSetRead[];
}

export interface WorkoutExerciseCreate {
  exercise_id: string;
  order_index?: number;
  notes?: string | null;
  sets?: WorkoutSetCreate[];
}

export interface WorkoutExerciseUpdate {
  order_index?: number;
  notes?: string | null;
}

export interface WorkoutSessionRead {
  id: string; // UUID
  user_id: string; // UUID
  name?: string | null;
  notes?: string | null;
  started_at: string;
  ended_at?: string | null;
  duration_minutes?: number | null;
  tags: string[];
  created_at: string;
  exercises: WorkoutExerciseRead[];
}

export interface WorkoutSessionCreate {
  name?: string | null;
  notes?: string | null;
  started_at: string; // Timezone-aware ISO string
  ended_at?: string | null;
  tags?: string[];
  exercises?: WorkoutExerciseCreate[];
}

export interface WorkoutSessionUpdate {
  name?: string | null;
  notes?: string | null;
  started_at?: string;
  ended_at?: string | null;
  tags?: string[];
}

export interface WorkoutSessionSummaryResponse {
  items: WorkoutSessionRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface WorkoutSearchParams {
  from_date?: string;
  to_date?: string;
  page?: number;
  size?: number;
}
