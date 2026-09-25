/**
 * Exercise Catalog TypeScript definitions mapped directly from backend:
 * backend/app/schemas/exercise.py
 * backend/app/models/exercise.py
 */

export const VALID_EXERCISE_CATEGORIES = ['strength', 'cardio', 'flexibility', 'balance'] as const;
export type ExerciseCategory = (typeof VALID_EXERCISE_CATEGORIES)[number];

export const EXERCISE_CATEGORY_LABELS: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  flexibility: 'Flexibility',
  balance: 'Balance',
};

export interface ExerciseRead {
  id: string; // UUID
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string | null;
  description: string | null;
  instructions: string | null;
  is_verified: boolean;
  created_by_user_id: string | null;
  created_at: string;
}

export interface ExerciseCreate {
  name: string;
  category: string;
  muscle_groups?: string[];
  equipment?: string | null;
  description?: string | null;
  instructions?: string | null;
}

export interface ExerciseUpdate {
  name?: string;
  category?: string;
  muscle_groups?: string[];
  equipment?: string | null;
  description?: string | null;
  instructions?: string | null;
}

export interface ExerciseSearchResponse {
  items: ExerciseRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ExerciseSearchParams {
  q?: string;
  category?: string;
  muscle_group?: string;
  page?: number;
  size?: number;
}
