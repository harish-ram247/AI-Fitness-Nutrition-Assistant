/**
 * TypeScript definitions mapped directly from backend Pydantic schemas:
 * backend/app/schemas/nutrition.py
 */

export const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof VALID_MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export interface FoodEntryRead {
  id: string; // UUID
  user_id: string; // UUID
  food_item_id: string; // UUID
  meal_type: string;
  quantity_g: number;
  food_name_snapshot: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  data_source_snapshot: string;
  usda_fdc_id_snapshot?: number | null;
  usda_dataset_version_snapshot?: string | null;
  logged_at: string;
  log_date: string;
  entry_source: string;
  created_at: string;
  updated_at: string;
}

export interface FoodEntryCreate {
  food_item_id: string;
  quantity_g?: number | null;
  serving_id?: string | null;
  serving_count?: number | null;
  meal_type: string;
  logged_at: string; // ISO string with timezone offset
}

export interface FoodEntryUpdate {
  quantity_g?: number;
  serving_id?: string;
  serving_count?: number;
  meal_type?: string;
  logged_at?: string;
}

export interface DailyTotals {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealSummary {
  calories: number;
  entries: FoodEntryRead[];
}

export interface DailyNutritionSummaryResponse {
  date: string;
  totals: DailyTotals;
  meals: Record<string, MealSummary>;
}

export interface NutritionHistoryItem {
  date: string; // YYYY-MM-DD
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionHistoryResponse {
  items: NutritionHistoryItem[];
  total_days: number;
}

export interface NaturalLanguageLogRequest {
  text: string;
  meal_type?: string;
  logged_at: string; // ISO string with timezone offset
}

export interface ResolvedFoodItemPreview {
  extracted_text: string;
  food_item_id: string;
  food_name: string;
  quantity_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
}

export interface UnresolvedFoodItem {
  extracted_text: string;
  recognized_name: string;
  suggested_action: string;
}

export interface NaturalLanguageLogPreview {
  extraction_id: string;
  resolved_items: ResolvedFoodItemPreview[];
  unresolved: UnresolvedFoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
}

export interface ConfirmedFoodItem {
  food_item_id: string;
  quantity_g?: number | null;
  serving_id?: string | null;
  serving_count?: number | null;
  meal_type: string;
  logged_at: string;
}

export interface NaturalLanguageConfirmRequest {
  confirmed_items: ConfirmedFoodItem[];
}
