import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import type {
  DailyNutritionSummaryResponse,
  FoodEntryRead,
  NutritionHistoryResponse,
  NaturalLanguageLogPreview,
} from '../src/types/nutrition';
import type { FoodItemRead, FoodSearchResponse } from '../src/types/food';

describe('Phase 8E — Nutrition & Food Logging Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-nutr-123',
    email: 'nutritionist@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  const mockFoodItem: FoodItemRead = {
    id: 'food-egg-1',
    name: 'Whole Egg',
    brand: null,
    barcode: null,
    source: 'usda',
    category: 'Dairy and Egg Products',
    calories_per_100g: 143,
    protein_per_100g: 12.6,
    carbs_per_100g: 0.7,
    fat_per_100g: 9.5,
    fiber_per_100g: 0,
    sugar_per_100g: 0.4,
    sodium_per_100g: 142,
    usda_fdc_id: 171287,
    usda_data_type: 'Foundation',
    usda_dataset_version: '2024-04',
    usda_imported_at: '2026-01-01T00:00:00Z',
    created_by_user_id: null,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
    servings: [
      {
        id: 'srv-egg-large',
        food_item_id: 'food-egg-1',
        description: '1 large egg',
        grams: 50,
        is_default: true,
      },
      {
        id: 'srv-egg-medium',
        food_item_id: 'food-egg-1',
        description: '1 medium egg',
        grams: 44,
        is_default: false,
      },
    ],
  };

  const mockEntry1: FoodEntryRead = {
    id: 'entry-1',
    user_id: 'user-nutr-123',
    food_item_id: 'food-egg-1',
    meal_type: 'breakfast',
    quantity_g: 100,
    food_name_snapshot: 'Whole Egg',
    calories: 143,
    protein_g: 12.6,
    carbs_g: 0.7,
    fat_g: 9.5,
    data_source_snapshot: 'usda',
    logged_at: '2026-09-24T08:00:00Z',
    log_date: '2026-09-24',
    entry_source: 'manual',
    created_at: '2026-09-24T08:00:00Z',
    updated_at: '2026-09-24T08:00:00Z',
  };

  const mockDailySummary: DailyNutritionSummaryResponse = {
    date: '2026-09-24',
    totals: {
      calories: 520,
      protein_g: 35.5,
      carbs_g: 45.0,
      fat_g: 18.2,
    },
    meals: {
      breakfast: {
        calories: 143,
        entries: [mockEntry1],
      },
      lunch: {
        calories: 377,
        entries: [],
      },
      dinner: {
        calories: 0,
        entries: [],
      },
      snack: {
        calories: 0,
        entries: [],
      },
    },
  };

  const mockEmptyDailySummary: DailyNutritionSummaryResponse = {
    date: '2026-09-24',
    totals: {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
    meals: {
      breakfast: { calories: 0, entries: [] },
      lunch: { calories: 0, entries: [] },
      dinner: { calories: 0, entries: [] },
      snack: { calories: 0, entries: [] },
    },
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    localStorage.setItem('fitness_access_token', 'valid-nutr-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderNutritionPage = () => {
    return render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );
  };

  // ==========================================
  // 1. DAILY NUTRITION TESTS
  // ==========================================

  it('1. nutrition page loads daily data and renders totals & meals', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nutrition & food logging/i })).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check daily totals
    await waitFor(() => {
      expect(screen.getByTestId('total-calories-value')).toHaveTextContent('520');
      expect(screen.getByTestId('total-protein-value')).toHaveTextContent('35.5');
      expect(screen.getByTestId('total-carbs-value')).toHaveTextContent('45.0');
      expect(screen.getByTestId('total-fat-value')).toHaveTextContent('18.2');
    });

    // Check meals
    expect(screen.getByRole('heading', { name: 'Breakfast' })).toBeInTheDocument();
    expect(screen.getByText('Whole Egg')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lunch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dinner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Snacks' })).toBeInTheDocument();
  });

  it('2. daily nutrition renders loading state while fetching', async () => {
    let resolveDaily!: (val: Response) => void;
    const dailyPromise = new Promise<Response>((resolve) => {
      resolveDaily = resolve;
    });

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return dailyPromise;
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    // Verify loading indicator is present
    await waitFor(() => {
      expect(screen.getByTestId('daily-nutrition-loading')).toBeInTheDocument();
    });

    // Resolve and verify content appears
    resolveDaily(new Response(JSON.stringify(mockDailySummary), { status: 200 }));

    await waitFor(() => {
      expect(screen.queryByTestId('daily-nutrition-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('total-calories-value')).toHaveTextContent('520');
    });
  });

  it('3. daily nutrition renders empty state when no meals logged', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockEmptyDailySummary), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByText(/no meals logged for this day yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('total-calories-value')).toHaveTextContent('0');
    });
  });

  it('4. daily API error displays error state and retry succeeds', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Database unavailable' }), { status: 500 });
        }
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/database unavailable/i);
    });

    // Click retry
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('total-calories-value')).toHaveTextContent('520');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  // ==========================================
  // 2. FOOD SEARCH TESTS
  // ==========================================

  it('5. food search requests foods and renders matching results', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        const searchResp: FoodSearchResponse = {
          items: [mockFoodItem],
          total: 1,
          page: 1,
          size: 20,
          pages: 1,
        };
        return new Response(JSON.stringify(searchResp), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    // Open log modal
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    // Verify modal is open
    const modal = screen.getByRole('dialog');
    expect(modal).toBeInTheDocument();

    const searchInput = within(modal).getByLabelText(/search food catalog/i);
    await userEvent.type(searchInput, 'egg');

    const searchSubmit = within(modal).getByRole('button', { name: /^search$/i });
    await userEvent.click(searchSubmit);

    // Verify result is displayed inside modal
    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
      expect(within(modal).getByText(/usda verified/i)).toBeInTheDocument();
      expect(within(modal).getByText(/143 kcal \/ 100g/i)).toBeInTheDocument();
    });
  });

  it('6. food search displays empty state when no items match', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, size: 20, pages: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    const searchInput = within(modal).getByLabelText(/search food catalog/i);
    await userEvent.type(searchInput, 'unicorn meat');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(within(modal).getByText(/no matching foods found in catalog/i)).toBeInTheDocument();
    });
  });

  it('7. food detail selection loads food details and available servings', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1, page: 1, size: 20, pages: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });

    // Click the food item in the modal
    await userEvent.click(within(modal).getByText('Whole Egg'));

    // Should load food detail configuration view inside modal
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /log: whole egg/i })).toBeInTheDocument();
      expect(within(modal).getByText(/predefined serving/i)).toBeInTheDocument();
      expect(within(modal).getByText(/custom quantity/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // 3. FOOD LOGGING TESTS
  // ==========================================

  it('8. quantity-based entry sends correct payload without serving fields', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1, page: 1, size: 20, pages: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/entries') && opts?.method === 'POST') {
        capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockEntry1), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByText('Whole Egg'));

    // Switch to Custom Quantity mode
    await waitFor(() => {
      expect(within(modal).getByRole('button', { name: /custom quantity/i })).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByRole('button', { name: /custom quantity/i }));

    // Enter 150g
    const qtyInput = within(modal).getByLabelText(/quantity \(grams\)/i);
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '150');

    // Select Meal "Lunch"
    const mealSelect = within(modal).getByLabelText(/meal/i);
    await userEvent.selectOptions(mealSelect, 'lunch');

    // Submit
    const submitBtn = within(modal).getByRole('button', { name: /add to diary/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const body = capturedBody as unknown as Record<string, unknown>;
    expect(body.food_item_id).toBe('food-egg-1');
    expect(body.meal_type).toBe('lunch');
    expect(body.quantity_g).toBe(150);
    expect(body.serving_id).toBeUndefined();
    expect(body.serving_count).toBeUndefined();
    expect(body.logged_at).toBeDefined();

    // Modal should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('9. serving-based entry sends serving_id and serving_count without quantity_g', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/entries') && opts?.method === 'POST') {
        capturedBody = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockEntry1), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByText('Whole Egg'));

    // Serving mode is default because servings exist
    await waitFor(() => {
      expect(within(modal).getByLabelText(/serving size/i)).toBeInTheDocument();
    });

    // Select serving count 3
    const countInput = within(modal).getByLabelText(/number of servings/i);
    await userEvent.clear(countInput);
    await userEvent.type(countInput, '3');

    // Select Meal "Breakfast"
    await userEvent.selectOptions(within(modal).getByLabelText(/meal/i), 'breakfast');

    // Submit
    await userEvent.click(within(modal).getByRole('button', { name: /add to diary/i }));

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
    });

    const body = capturedBody as unknown as Record<string, unknown>;
    expect(body.food_item_id).toBe('food-egg-1');
    expect(body.meal_type).toBe('breakfast');
    expect(body.serving_id).toBe('srv-egg-large');
    expect(body.serving_count).toBe(3);
    expect(body.quantity_g).toBeUndefined();
    expect(body.logged_at).toBeDefined();
  });

  it('10. invalid quantity/serving validation prevents submission', async () => {
    let postCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/entries') && opts?.method === 'POST') {
        postCalled = true;
        return new Response(JSON.stringify(mockEntry1), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByText('Whole Egg'));

    // Switch to quantity mode
    await waitFor(() => {
      expect(within(modal).getByRole('button', { name: /custom quantity/i })).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByRole('button', { name: /custom quantity/i }));

    // Set invalid 0 quantity
    const qtyInput = within(modal).getByLabelText(/quantity \(grams\)/i);
    await userEvent.clear(qtyInput);
    await userEvent.type(qtyInput, '0');

    await userEvent.click(within(modal).getByRole('button', { name: /add to diary/i }));

    await waitFor(() => {
      expect(within(modal).getByText(/quantity must be strictly greater than 0/i)).toBeInTheDocument();
    });
    expect(postCalled).toBe(false);
  });

  it('11. successful food entry refreshes daily nutrition data', async () => {
    let dailyCalls = 0;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        dailyCalls++;
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/entries') && opts?.method === 'POST') {
        return new Response(JSON.stringify(mockEntry1), { status: 201 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(dailyCalls).toBe(1);
    });

    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));
    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByText('Whole Egg'));

    await waitFor(() => {
      expect(within(modal).getByRole('button', { name: /add to diary/i })).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByRole('button', { name: /add to diary/i }));

    await waitFor(() => {
      expect(dailyCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('12. entry API error displays error alert in modal and keeps modal open', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/foods') && !url.includes('/api/v1/foods/')) {
        return new Response(JSON.stringify({ items: [mockFoodItem], total: 1 }), { status: 200 });
      }
      if (url.includes(`/api/v1/foods/${mockFoodItem.id}`)) {
        return new Response(JSON.stringify(mockFoodItem), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/entries') && opts?.method === 'POST') {
        return new Response(
          JSON.stringify({
            detail: 'Cannot supply both quantity_g and serving information',
          }),
          { status: 422 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ log food/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /\+ log food/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/search food catalog/i), 'egg');
    await userEvent.click(within(modal).getByRole('button', { name: /^search$/i }));
    await waitFor(() => {
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByText('Whole Egg'));

    await waitFor(() => {
      expect(within(modal).getByRole('button', { name: /add to diary/i })).toBeInTheDocument();
    });
    await userEvent.click(within(modal).getByRole('button', { name: /add to diary/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/cannot supply both quantity_g/i);
    });
    // Modal is still present
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ==========================================
  // 4. EDIT & DELETE TESTS
  // ==========================================

  it('13. edit entry sends updated quantity and meal type and refreshes', async () => {
    let patchBody: Record<string, unknown> | null = null;
    let dailyCalls = 0;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        dailyCalls++;
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes(`/api/v1/nutrition/entries/${mockEntry1.id}`) && opts?.method === 'PATCH') {
        patchBody = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...mockEntry1, quantity_g: 200 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByText('Whole Egg')).toBeInTheDocument();
    });

    // Find and click the edit button
    const editBtn = screen.getByRole('button', { name: /edit entry whole egg/i });
    await userEvent.click(editBtn);

    // Edit modal appears
    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /edit food entry/i })).toBeInTheDocument();
      expect(within(modal).getByText('Whole Egg')).toBeInTheDocument();
    });

    // Update quantity to 200
    const editQtyInput = within(modal).getByLabelText(/quantity \(grams\)/i);
    await userEvent.clear(editQtyInput);
    await userEvent.type(editQtyInput, '200');

    // Submit update
    const saveBtn = within(modal).getByRole('button', { name: /update entry/i });
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(patchBody).not.toBeNull();
    });
    const body = patchBody as unknown as Record<string, unknown>;
    expect(body.quantity_g).toBe(200);

    // Edit modal closes and daily summary refreshes
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /edit food entry/i })).not.toBeInTheDocument();
      expect(dailyCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('14. delete confirmation requires explicit confirmation before calling API', async () => {
    let deleteCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes(`/api/v1/nutrition/entries/${mockEntry1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByText('Whole Egg')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete entry whole egg/i });
    await userEvent.click(deleteBtn);

    // Confirmation dialog appears
    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /delete food entry/i })).toBeInTheDocument();
      expect(within(modal).getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    });
    // Not deleted yet
    expect(deleteCalled).toBe(false);

    // Click Cancel
    const cancelBtn = within(modal).getByRole('button', { name: /^cancel$/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /delete food entry/i })).not.toBeInTheDocument();
    });
    expect(deleteCalled).toBe(false);
  });

  it('15. successful delete calls DELETE endpoint and refreshes daily summary', async () => {
    let deleteCalled = false;
    let dailyCalls = 0;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        dailyCalls++;
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes(`/api/v1/nutrition/entries/${mockEntry1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByText('Whole Egg')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete entry whole egg/i }));

    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /delete food entry/i })).toBeInTheDocument();
    });

    // Confirm deletion
    const confirmDeleteBtn = within(modal).getByRole('button', { name: /confirm delete/i });
    await userEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByRole('heading', { name: /delete food entry/i })).not.toBeInTheDocument();
      expect(dailyCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('16. failed delete preserves entry and renders error message', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes(`/api/v1/nutrition/entries/${mockEntry1.id}`) && opts?.method === 'DELETE') {
        return new Response(JSON.stringify({ detail: 'Entry cannot be deleted due to lock' }), { status: 409 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByText('Whole Egg')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete entry whole egg/i }));

    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /delete food entry/i })).toBeInTheDocument();
    });

    await userEvent.click(within(modal).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/entry cannot be deleted/i);
    });

    // Dialog stays open and entry is preserved
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // ==========================================
  // 5. NUTRITION HISTORY TESTS
  // ==========================================

  it('17. history loading and rendering displays historical days and macro breakdown', async () => {
    const mockHistory: NutritionHistoryResponse = {
      items: [
        {
          date: '2026-09-24',
          calories: 2150,
          protein_g: 160,
          carbs_g: 220,
          fat_g: 70,
        },
        {
          date: '2026-09-23',
          calories: 1980,
          protein_g: 145,
          carbs_g: 200,
          fat_g: 65,
        },
      ],
      total_days: 2,
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/history')) {
        return new Response(JSON.stringify(mockHistory), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nutrition history/i })).toBeInTheDocument();
    });

    // Switch to history tab
    await userEvent.click(screen.getByRole('button', { name: /nutrition history/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nutrition history/i })).toBeInTheDocument();
      expect(screen.getByTestId('history-item-2026-09-24')).toBeInTheDocument();
      expect(screen.getByTestId('history-item-2026-09-23')).toBeInTheDocument();
      expect(within(screen.getByTestId('history-item-2026-09-24')).getByText('2150')).toBeInTheDocument();
      expect(within(screen.getByTestId('history-item-2026-09-23')).getByText('1980')).toBeInTheDocument();
    });
  });

  it('18. history empty and error state handling with retry', async () => {
    let historyCallCount = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/history')) {
        historyCallCount++;
        if (historyCallCount === 1) {
          return new Response(JSON.stringify({ detail: 'Failed to aggregate history' }), { status: 500 });
        }
        return new Response(
          JSON.stringify({
            items: [],
            total_days: 0,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /nutrition history/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /nutrition history/i }));

    // Error first
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/failed to aggregate history/i);
    });

    // Retry
    const retryBtn = screen.getByRole('button', { name: /retry history/i });
    await userEvent.click(retryBtn);

    // Empty state rendered
    await waitFor(() => {
      expect(screen.getByText(/no nutrition history recorded for this period/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // 6. NATURAL LANGUAGE FOOD LOGGING TESTS
  // ==========================================

  const mockNlPreview: NaturalLanguageLogPreview = {
    extraction_id: 'nl-ext-123',
    resolved_items: [
      {
        food_item_id: 'food-egg-1',
        food_name: 'Whole Egg',
        extracted_text: '2 large eggs',
        quantity_g: 100,
        calories: 143,
        protein_g: 12.6,
        carbs_g: 0.7,
        fat_g: 9.5,
        confidence: 'high',
      },
    ],
    unresolved: [],
    total_calories: 143,
    total_protein_g: 12.6,
    total_carbs_g: 0.7,
    total_fat_g: 9.5,
  };

  it('19. natural-language preview requests extraction and displays preview card', async () => {
    let previewRequest: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language') && !url.includes('/confirm')) {
        previewRequest = JSON.parse(opts?.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockNlPreview), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /natural-language food logger/i })).toBeInTheDocument();
    });

    const nlInput = screen.getByLabelText(/describe what you ate/i);
    await userEvent.type(nlInput, '2 large eggs for breakfast');

    const previewBtn = screen.getByRole('button', { name: /preview nutrition/i });
    await userEvent.click(previewBtn);

    await waitFor(() => {
      expect(previewRequest).not.toBeNull();
      const req = previewRequest as unknown as Record<string, unknown>;
      expect(req.text).toBe('2 large eggs for breakfast');
      expect(req.logged_at).toBeDefined();
      expect(screen.getByText(/preview only — not yet committed/i)).toBeInTheDocument();
      expect(screen.getByText(/extracted: "2 large eggs" · 100g/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /confirm & log to diary/i })).toBeInTheDocument();
    });
  });

  it('20. preview is not treated as committed until user explicitly confirms', async () => {
    let confirmCalled = false;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language/confirm')) {
        confirmCalled = true;
        return new Response(JSON.stringify([]), { status: 201 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language')) {
        return new Response(JSON.stringify(mockNlPreview), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /natural-language food logger/i })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/describe what you ate/i), '2 large eggs');
    await userEvent.click(screen.getByRole('button', { name: /preview nutrition/i }));

    await waitFor(() => {
      expect(screen.getByText(/preview only — not yet committed/i)).toBeInTheDocument();
    });

    // Crucial requirement: confirm was NOT called
    expect(confirmCalled).toBe(false);

    // Cancel preview
    const cancelBtn = screen.getByRole('button', { name: /cancel preview/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText(/preview only — not yet committed/i)).not.toBeInTheDocument();
    });
    expect(confirmCalled).toBe(false);
  });

  it('21. explicit confirmation creates entry and refreshes daily summary', async () => {
    let confirmBody: { confirmed_items: Record<string, unknown>[] } | null = null;
    let dailyCalls = 0;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        dailyCalls++;
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language/confirm')) {
        confirmBody = JSON.parse(opts?.body as string) as { confirmed_items: Record<string, unknown>[] };
        return new Response(JSON.stringify([mockEntry1]), { status: 201 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language')) {
        return new Response(JSON.stringify(mockNlPreview), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /natural-language food logger/i })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/describe what you ate/i), '2 large eggs');
    await userEvent.click(screen.getByRole('button', { name: /preview nutrition/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm & log to diary/i })).toBeInTheDocument();
    });

    // Select Meal "Breakfast" during preview
    const mealSelect = screen.getByLabelText(/assign to meal/i);
    await userEvent.selectOptions(mealSelect, 'breakfast');

    // Confirm
    await userEvent.click(screen.getByRole('button', { name: /confirm & log to diary/i }));

    await waitFor(() => {
      expect(confirmBody).not.toBeNull();
    });

    const body = confirmBody as unknown as { confirmed_items: Record<string, unknown>[] };
    expect(body.confirmed_items).toHaveLength(1);
    expect(body.confirmed_items[0].food_item_id).toBe('food-egg-1');
    expect(body.confirmed_items[0].quantity_g).toBe(100);
    expect(body.confirmed_items[0].meal_type).toBe('breakfast');
    expect(body.confirmed_items[0].logged_at).toBeDefined();

    // Success feedback rendered and daily data refreshed
    await waitFor(() => {
      expect(screen.getByText(/successfully logged 1 food item to breakfast/i)).toBeInTheDocument();
      expect(dailyCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('22. failed confirmation does not mark entry as logged and displays error', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language/confirm')) {
        return new Response(JSON.stringify({ detail: 'LLM service timeout during confirmation' }), { status: 504 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language')) {
        return new Response(JSON.stringify(mockNlPreview), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /natural-language food logger/i })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/describe what you ate/i), '2 large eggs');
    await userEvent.click(screen.getByRole('button', { name: /preview nutrition/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm & log to diary/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /confirm & log to diary/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/llm service timeout/i);
    });

    // Success message is NOT shown
    expect(screen.queryByText(/successfully logged/i)).not.toBeInTheDocument();
    // Preview is still available so user can re-try
    expect(screen.getByRole('button', { name: /confirm & log to diary/i })).toBeInTheDocument();
  });

  it('23. unresolved and invalid natural-language items are handled safely', async () => {
    const previewWithUnresolved: NaturalLanguageLogPreview = {
      extraction_id: 'nl-ext-456',
      resolved_items: [],
      unresolved: [
        {
          extracted_text: 'moon dust shake',
          recognized_name: 'Moon Dust Shake',
          suggested_action: 'Please search manually for this food item.',
        },
      ],
      total_calories: 0,
      total_protein_g: 0,
      total_carbs_g: 0,
      total_fat_g: 0,
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockDailySummary), { status: 200 });
      }
      if (url.includes('/api/v1/nutrition/log-natural-language')) {
        return new Response(JSON.stringify(previewWithUnresolved), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderNutritionPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /natural-language food logger/i })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText(/describe what you ate/i), 'drank a moon dust shake');
    await userEvent.click(screen.getByRole('button', { name: /preview nutrition/i }));

    await waitFor(() => {
      expect(screen.getByText(/unresolved items \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/moon dust shake/i)).toBeInTheDocument();
      expect(screen.getByText(/please search manually for this food item/i)).toBeInTheDocument();
    });

    // Confirm button should be disabled when 0 items resolved
    const confirmBtn = screen.getByRole('button', { name: /confirm & log to diary/i });
    expect(confirmBtn).toBeDisabled();

    // User can cancel safely
    const cancelBtn = screen.getByRole('button', { name: /cancel preview/i });
    await userEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText(/unresolved items/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================
  // 7. ROUTING TESTS
  // ==========================================

  it('24. /nutrition route is protected and redirects unauthenticated visitor to /login', async () => {
    localStorage.removeItem('fitness_access_token');

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/nutrition & food logging/i)).not.toBeInTheDocument();
  });
});
