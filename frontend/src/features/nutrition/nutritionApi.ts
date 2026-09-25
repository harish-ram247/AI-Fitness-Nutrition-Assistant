import { apiClient } from '../../api/client';
import type {
  FoodItemRead,
  FoodSearchResponse,
  CustomFoodCreate,
  CustomFoodUpdate,
} from '../../types/food';
import type {
  DailyNutritionSummaryResponse,
  FoodEntryCreate,
  FoodEntryRead,
  FoodEntryUpdate,
  NutritionHistoryResponse,
  NaturalLanguageConfirmRequest,
  NaturalLanguageLogPreview,
  NaturalLanguageLogRequest,
} from '../../types/nutrition';

/**
 * Dedicated Nutrition & Food Catalog API service matching FastAPI contracts:
 * - /api/v1/foods
 * - /api/v1/nutrition
 */
export const nutritionApi = {
  /**
   * Search food catalog and custom foods.
   * GET /api/v1/foods
   */
  async searchFoods(params?: {
    q?: string;
    category?: string;
    page?: number;
    size?: number;
  }): Promise<FoodSearchResponse> {
    return apiClient.get<FoodSearchResponse>('/api/v1/foods', {
      params: {
        q: params?.q,
        category: params?.category,
        page: params?.page,
        size: params?.size,
      },
    });
  },

  /**
   * Get single food item details including servings.
   * GET /api/v1/foods/{food_id}
   */
  async getFood(foodId: string): Promise<FoodItemRead> {
    return apiClient.get<FoodItemRead>(`/api/v1/foods/${foodId}`);
  },

  /**
   * Create a custom food item.
   * POST /api/v1/foods
   */
  async createCustomFood(data: CustomFoodCreate): Promise<FoodItemRead> {
    return apiClient.post<FoodItemRead>('/api/v1/foods', data);
  },

  /**
   * Update a custom food item (owner only).
   * PATCH /api/v1/foods/{food_id}
   */
  async updateCustomFood(foodId: string, data: CustomFoodUpdate): Promise<FoodItemRead> {
    return apiClient.patch<FoodItemRead>(`/api/v1/foods/${foodId}`, data);
  },

  /**
   * Delete a custom food item (owner only).
   * DELETE /api/v1/foods/{food_id} -> 204 No Content
   */
  async deleteCustomFood(foodId: string): Promise<void> {
    await apiClient.delete<void>(`/api/v1/foods/${foodId}`);
  },

  /**
   * Get daily nutrition summary and meal breakdown for a given date.
   * GET /api/v1/nutrition/daily?date=YYYY-MM-DD
   */
  async getDailyNutrition(date: string): Promise<DailyNutritionSummaryResponse> {
    return apiClient.get<DailyNutritionSummaryResponse>('/api/v1/nutrition/daily', {
      params: { date },
    });
  },

  /**
   * Log a new food entry.
   * POST /api/v1/nutrition/entries
   */
  async createFoodEntry(data: FoodEntryCreate): Promise<FoodEntryRead> {
    return apiClient.post<FoodEntryRead>('/api/v1/nutrition/entries', data);
  },

  /**
   * Update an existing food entry.
   * PATCH /api/v1/nutrition/entries/{entry_id}
   */
  async updateFoodEntry(entryId: string, data: FoodEntryUpdate): Promise<FoodEntryRead> {
    return apiClient.patch<FoodEntryRead>(`/api/v1/nutrition/entries/${entryId}`, data);
  },

  /**
   * Delete an existing food entry.
   * DELETE /api/v1/nutrition/entries/{entry_id} -> 204 No Content
   */
  async deleteFoodEntry(entryId: string): Promise<void> {
    await apiClient.delete<void>(`/api/v1/nutrition/entries/${entryId}`);
  },

  /**
   * Get aggregated nutrition history over a date range.
   * GET /api/v1/nutrition/history?from=YYYY-MM-DD&to=YYYY-MM-DD
   */
  async getNutritionHistory(fromDate: string, toDate: string): Promise<NutritionHistoryResponse> {
    return apiClient.get<NutritionHistoryResponse>('/api/v1/nutrition/history', {
      params: { from: fromDate, to: toDate },
    });
  },

  /**
   * Preview natural-language food log extraction.
   * POST /api/v1/nutrition/log-natural-language
   */
  async previewNaturalLanguage(data: NaturalLanguageLogRequest): Promise<NaturalLanguageLogPreview> {
    return apiClient.post<NaturalLanguageLogPreview>('/api/v1/nutrition/log-natural-language', data);
  },

  /**
   * Confirm natural-language food log items.
   * POST /api/v1/nutrition/log-natural-language/confirm
   */
  async confirmNaturalLanguage(data: NaturalLanguageConfirmRequest): Promise<FoodEntryRead[]> {
    return apiClient.post<FoodEntryRead[]>('/api/v1/nutrition/log-natural-language/confirm', data);
  },
};
