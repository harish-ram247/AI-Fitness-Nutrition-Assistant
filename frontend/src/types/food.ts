/**
 * Food Catalog TypeScript definitions mapped directly from backend:
 * backend/app/schemas/food.py
 * backend/app/models/food.py
 */

export interface FoodItemServingRead {
  id: string; // UUID
  food_item_id: string; // UUID
  description: string;
  grams: number;
  is_default: boolean;
}

export interface FoodItemRead {
  id: string; // UUID
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number | null;
  sugar_per_100g: number | null;
  sodium_per_100g: number | null;
  source: 'usda' | 'custom' | string;
  usda_fdc_id: number | null;
  usda_data_type: string | null;
  usda_dataset_version: string | null;
  usda_imported_at: string | null;
  created_by_user_id: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  servings: FoodItemServingRead[];
}

export interface FoodSearchResponse {
  items: FoodItemRead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ServingCreate {
  description: string;
  grams: number;
  is_default?: boolean;
}

export interface CustomFoodCreate {
  name: string;
  brand?: string | null;
  category?: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  sodium_per_100g?: number | null;
  servings?: ServingCreate[];
}

export interface CustomFoodUpdate {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  calories_per_100g?: number | null;
  protein_per_100g?: number | null;
  carbs_per_100g?: number | null;
  fat_per_100g?: number | null;
  fiber_per_100g?: number | null;
  sugar_per_100g?: number | null;
  sodium_per_100g?: number | null;
}
