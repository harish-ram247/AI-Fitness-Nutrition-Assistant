/**
 * User Preferences TypeScript definitions mapped directly from backend:
 * backend/app/schemas/user.py (UserPreferenceRead, UserPreferenceUpdate)
 * backend/app/models/user.py (UserPreference)
 */

export type UnitSystem = 'metric' | 'imperial';

export type AiPersona = 'balanced' | 'direct' | 'supportive' | 'analytical';

export const UNIT_SYSTEM_OPTIONS: { value: UnitSystem; label: string; description: string }[] = [
  { value: 'metric', label: 'Metric', description: 'Kilograms (kg), Centimeters (cm)' },
  { value: 'imperial', label: 'Imperial', description: 'Pounds (lbs), Inches (in)' },
];

export const AI_PERSONA_OPTIONS: { value: AiPersona; label: string; description: string }[] = [
  { value: 'balanced', label: 'Balanced', description: 'Encouraging, pragmatic, and well-rounded advice' },
  { value: 'direct', label: 'Direct', description: 'Concise, goal-focused, and no-nonsense coaching' },
  { value: 'supportive', label: 'Supportive', description: 'Empathetic, motivating, and positive reinforcement' },
  { value: 'analytical', label: 'Analytical', description: 'Data-driven, precise breakdown of metrics & progress' },
];

export const COMMON_DIETARY_RESTRICTIONS: { value: string; label: string }[] = [
  { value: 'gluten_free', label: 'Gluten-Free' },
  { value: 'dairy_free', label: 'Dairy-Free' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'low_carb', label: 'Low Carb' },
  { value: 'nut_free', label: 'Nut-Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
];

export interface UserPreferenceRead {
  id: string; // UUID
  user_id: string; // UUID
  unit_system: string;
  calorie_target: number | null;
  protein_target_g: number | string | null;
  carbs_target_g: number | string | null;
  fat_target_g: number | string | null;
  dietary_restrictions: string[];
  ai_persona: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferenceUpdate {
  unit_system?: string | null;
  calorie_target?: number | null;
  protein_target_g?: number | string | null;
  carbs_target_g?: number | string | null;
  fat_target_g?: number | string | null;
  dietary_restrictions?: string[] | null;
  ai_persona?: string | null;
}
