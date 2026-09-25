/**
 * Profile TypeScript definitions mapped directly from backend:
 * backend/app/schemas/user.py (UserProfileRead, UserProfileUpdate)
 * backend/app/models/user.py (UserProfile)
 */

export type ActivityLevel =
  | 'sedentary'
  | 'lightly_active'
  | 'moderately_active'
  | 'very_active'
  | 'extremely_active'
  | 'moderate'
  | 'active';

export const ACTIVITY_LEVEL_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little or no exercise, desk job' },
  { value: 'lightly_active', label: 'Lightly Active', description: 'Light exercise or sports 1-3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week' },
  { value: 'very_active', label: 'Very Active', description: 'Hard exercise 6-7 days/week' },
  { value: 'extremely_active', label: 'Extremely Active', description: 'Very hard daily exercise / physical job' },
];

export const SEX_OPTIONS: { value: string; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export interface UserProfileRead {
  id: string; // UUID
  user_id: string; // UUID
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null; // YYYY-MM-DD
  sex: string | null;
  height_cm: number | string | null; // Decimal from backend
  current_weight_kg: number | string | null; // Read-only derived cache from weight_entries (ADR-014)
  activity_level: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfileUpdate {
  first_name: string;
  last_name?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  height_cm?: number | string | null;
  activity_level?: string;
}
