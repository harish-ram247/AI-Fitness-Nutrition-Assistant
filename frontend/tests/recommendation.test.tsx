import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import type {
  MealComponentResponse,
  MealRecommendationItem,
  MealRecommendationResponse,
  WorkoutExerciseResponse,
  WorkoutRecommendationItem,
  WorkoutRecommendationResponse,
} from '../src/types/recommendation';

describe('Phase 8G — Recommendation Hub Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-rec-123',
    email: 'athlete@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  const mockMealComponent1: MealComponentResponse = {
    food_id: 'food-chicken',
    food_name: 'Grilled Chicken Breast',
    quantity_g: 200,
    serving_id: 'serv-1',
    serving_description: '1 breast (200g)',
    serving_count: 1,
    calories: 330,
    protein_g: 62,
    carbs_g: 0,
    fat_g: 7,
  };

  const mockMealComponent2: MealComponentResponse = {
    food_id: 'food-rice',
    food_name: 'Brown Rice',
    quantity_g: 150,
    serving_id: 'serv-2',
    serving_description: '1 cup cooked (150g)',
    serving_count: 1,
    calories: 165,
    protein_g: 4,
    carbs_g: 35,
    fat_g: 1.5,
  };

  const mockMealItem1: MealRecommendationItem = {
    id: 'meal-cand-1',
    name: 'High-Protein Chicken & Brown Rice Bowl',
    meal_type: 'lunch',
    components: [mockMealComponent1, mockMealComponent2],
    total_calories: 495,
    total_protein_g: 66,
    total_carbs_g: 35,
    total_fat_g: 8.5,
    score: 0.94,
    reasons: ['Calorie target match', 'High protein density'],
    factor_scores: [
      {
        factor_name: 'CalorieProximity',
        normalized_score: 0.95,
        weight: 0.4,
        weighted_contribution: 0.38,
        reason: 'Within 5% of target',
      },
    ],
    ai_explanation: null,
    ai_rank: null,
  };

  const mockMealItem2: MealRecommendationItem = {
    id: 'meal-cand-2',
    name: 'Salmon & Quinoa Salad',
    meal_type: 'lunch',
    components: [],
    total_calories: 520,
    total_protein_g: 42,
    total_carbs_g: 40,
    total_fat_g: 16,
    score: 0.88,
    reasons: ['Healthy fats', 'Omega-3 rich'],
    factor_scores: [],
    ai_explanation: null,
    ai_rank: null,
  };

  const mockMealResponse: MealRecommendationResponse = {
    recommendation_type: 'meal',
    meal_type: 'lunch',
    target_calories: 500,
    target_protein_g: 50,
    remaining_daily_calories: 1200,
    items: [mockMealItem1],
    total_generated: 25,
    total_survived_filtering: 8,
    disclaimer:
      'Allergen and dietary filtering is based on food names and USDA category metadata. It does not replace medical advice or guarantee the absence of cross-contamination.',
    metadata: { daily_budget_tracked: true },
    ai_used: false,
    ai_fallback: false,
    ai_summary: null,
    ai_considerations: [],
  };

  const mockWorkoutExerciseItem1: WorkoutExerciseResponse = {
    exercise_id: 'ex-bench-press',
    exercise_name: 'Barbell Bench Press',
    category: 'strength',
    muscle_groups: ['chest', 'triceps', 'shoulders'],
    equipment: 'Barbell',
    order_index: 0,
    recommended_sets: 4,
    recommended_reps: 8,
    recommended_duration_seconds: null,
    recommended_rest_seconds: 90,
  };

  const mockWorkoutExerciseItem2: WorkoutExerciseResponse = {
    exercise_id: 'ex-incline-press',
    exercise_name: 'Incline Dumbbell Press',
    category: 'strength',
    muscle_groups: ['chest', 'shoulders'],
    equipment: 'Dumbbells',
    order_index: 1,
    recommended_sets: 3,
    recommended_reps: 10,
    recommended_duration_seconds: null,
    recommended_rest_seconds: 60,
  };

  const mockWorkoutItem1: WorkoutRecommendationItem = {
    id: 'workout-cand-1',
    name: 'Hypertrophy Push Session A',
    workout_type: 'push',
    category: 'strength',
    target_muscle_groups: ['chest', 'shoulders', 'triceps'],
    estimated_duration_minutes: 45,
    total_sets: 7,
    primary_equipment_needed: ['Barbell', 'Dumbbells'],
    variant: 'standard',
    score: 0.91,
    reasons: ['Target duration fit', 'Chest muscle freshness fit'],
    factor_scores: [
      {
        factor_name: 'DurationFit',
        normalized_score: 0.98,
        weight: 0.3,
        weighted_contribution: 0.294,
        reason: 'Perfect duration estimate',
      },
    ],
    exercises: [mockWorkoutExerciseItem1, mockWorkoutExerciseItem2],
    ai_explanation: null,
    ai_rank: null,
  };

  const mockWorkoutResponse: WorkoutRecommendationResponse = {
    recommendation_type: 'workout',
    target_duration_minutes: 45,
    workout_type: 'push',
    items: [mockWorkoutItem1],
    total_generated: 14,
    total_survived_filtering: 6,
    disclaimer:
      'Workout recommendations are training suggestions based on catalog metadata and recent logs. They do not replace medical advice or professional athletic instruction.',
    metadata: {},
    ai_used: false,
    ai_fallback: false,
    ai_summary: null,
    ai_considerations: [],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    localStorage.setItem('fitness_access_token', 'mock_access_token_123');
    mockFetch.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderRecommendationsPage = async (initialPath = '/recommendations') => {
    const rendered = render(
      <AuthProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    // Wait for auth initialization
    await waitFor(() => {
      expect(screen.queryByText(/loading session/i)).not.toBeInTheDocument();
    });

    return rendered;
  };

  // ==========================================
  // GENERAL & ROUTING TESTS
  // ==========================================

  it('1. /recommendations route is protected and redirects unauthenticated users', async () => {
    localStorage.removeItem('fitness_access_token');

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/recommendations']}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('2. recommendations page renders header, tabs, and initial controls', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /recommendation hub/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /meal recommendations/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /workout recommendations/i })).toBeInTheDocument();
    });
  });

  it('3. meal/workout tabs switch correctly between panels', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    // Initially meals tab is active
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /meal recommendations/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('High-Protein Chicken & Brown Rice Bowl')).toBeInTheDocument();
    });

    // Switch to Workouts tab
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /workout recommendations/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Hypertrophy Push Session A')).toBeInTheDocument();
    });
  });

  // ==========================================
  // MEALS TESTS
  // ==========================================

  it('4. meal recommendation request is sent on page mount', async () => {
    let mealCalled = false;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        mealCalled = true;
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(mealCalled).toBe(true);
      expect(screen.getByText('High-Protein Chicken & Brown Rice Bowl')).toBeInTheDocument();
    });
  });

  it('5. meal controls send correct backend query parameters', async () => {
    let capturedUrl = '';

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        capturedUrl = url;
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    // Fill in controls
    const mealTypeSelect = screen.getByLabelText(/meal type/i);
    await userEvent.selectOptions(mealTypeSelect, 'dinner');

    const calInput = screen.getByLabelText(/target calories/i);
    await userEvent.type(calInput, '750');

    const allergiesInput = screen.getByLabelText(/allergies/i);
    await userEvent.type(allergiesInput, 'peanuts, shellfish');

    const dislikedInput = screen.getByLabelText(/disliked foods/i);
    await userEvent.type(dislikedInput, 'broccoli');

    const limitSelect = screen.getByLabelText(/max results/i);
    await userEvent.selectOptions(limitSelect, '5');

    await userEvent.click(screen.getByRole('button', { name: /get meal recommendations/i }));

    await waitFor(() => {
      expect(capturedUrl).toContain('meal_type=dinner');
      expect(capturedUrl).toContain('target_calories=750');
      expect(capturedUrl).toContain('allergies=peanuts');
      expect(capturedUrl).toContain('allergies=shellfish');
      expect(capturedUrl).toContain('disliked_foods=broccoli');
      expect(capturedUrl).toContain('limit=5');
    });
  });

  it('6. meal recommendations render candidate name, macros, calories, components, and fit score', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.getByText('High-Protein Chicken & Brown Rice Bowl')).toBeInTheDocument();
      expect(screen.getByText('495')).toBeInTheDocument();
      expect(screen.getByText('66')).toBeInTheDocument();
      expect(screen.getByText('35')).toBeInTheDocument();
      expect(screen.getByText('8.5')).toBeInTheDocument();
      expect(screen.getByText('Grilled Chicken Breast')).toBeInTheDocument();
      expect(screen.getByText('Brown Rice')).toBeInTheDocument();
      expect(screen.getByText('94%')).toBeInTheDocument();
    });
  });

  it('7. meal empty state renders when no recommendations match', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(
          JSON.stringify({ ...mockMealResponse, items: [] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.getByText(/no meal recommendations matched your criteria/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset filters & retry/i })).toBeInTheDocument();
    });
  });

  it('8. meal API error displays alert and retry succeeds', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Service Temporarily Unavailable' }), { status: 503 });
        }
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/service temporarily unavailable/i);
    });

    // Click Retry
    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));

    await waitFor(() => {
      expect(screen.getByText('High-Protein Chicken & Brown Rice Bowl')).toBeInTheDocument();
    });
  });

  // ==========================================
  // WORKOUTS TESTS
  // ==========================================

  it('9. workout recommendation request is sent when workout tab is activated', async () => {
    let workoutCalled = false;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        workoutCalled = true;
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(workoutCalled).toBe(true);
      expect(screen.getByText('Hypertrophy Push Session A')).toBeInTheDocument();
    });
  });

  it('10. workout controls send correct backend parameters', async () => {
    let capturedUrl = '';

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        capturedUrl = url;
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/target duration/i)).toBeInTheDocument();
    });

    const durationInput = screen.getByLabelText(/target duration/i);
    await userEvent.clear(durationInput);
    await userEvent.type(durationInput, '60');

    const typeSelect = screen.getByLabelText(/workout type/i);
    // Explicitly verify canonical types: mobility is supported; recovery, legs, and hiit are strictly absent
    expect(screen.getByRole('option', { name: /mobility/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /recovery/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^legs$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^hiit$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /full body/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /upper body/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /lower body/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /push/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /pull/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /cardio/i })).toBeInTheDocument();

    await userEvent.selectOptions(typeSelect, 'pull');

    const eqInput = screen.getByLabelText(/available equipment/i);
    await userEvent.type(eqInput, 'barbell, dumbbell');

    const limitSelect = screen.getByLabelText(/max results/i);
    await userEvent.selectOptions(limitSelect, '3');

    await userEvent.click(screen.getByRole('button', { name: /get workout recommendations/i }));

    await waitFor(() => {
      expect(capturedUrl).toContain('target_duration_minutes=60');
      expect(capturedUrl).toContain('workout_type=pull');
      expect(capturedUrl).toContain('equipment=barbell');
      expect(capturedUrl).toContain('equipment=dumbbell');
      expect(capturedUrl).toContain('limit=3');
    });
  });

  it('11. workout recommendations render duration, exercises, sets, reps, and rest', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getByText('Hypertrophy Push Session A')).toBeInTheDocument();
      expect(screen.getAllByText(/⏱ 45 min/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Incline Dumbbell Press')).toBeInTheDocument();
      expect(screen.getByText(/90s rest/i)).toBeInTheDocument();
      expect(screen.getByText('91%')).toBeInTheDocument();
    });
  });

  it('12. workout empty state renders when no programs match', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        return new Response(
          JSON.stringify({ ...mockWorkoutResponse, items: [] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getByText(/no workout recommendations matched your duration and equipment criteria/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset filters & retry/i })).toBeInTheDocument();
    });
  });

  it('13. workout API error displays alert and retry succeeds', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Internal Server Error' }), { status: 500 });
        }
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/internal server error/i);
    });

    await userEvent.click(screen.getByRole('button', { name: /^retry$/i }));

    await waitFor(() => {
      expect(screen.getByText('Hypertrophy Push Session A')).toBeInTheDocument();
    });
  });

  // ==========================================
  // AI ENRICHMENT & FALLBACK TESTS
  // ==========================================

  it('14. deterministic mode does not request AI (include_ai=false)', async () => {
    let capturedUrl = '';

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        capturedUrl = url;
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(capturedUrl).not.toContain('include_ai=true');
      expect(capturedUrl).toContain('include_ai=false');
    });
  });

  it('15. explicit AI mode sends include_ai=true', async () => {
    let capturedUrl = '';

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        capturedUrl = url;
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    const aiCheckbox = screen.getByLabelText(/include ai explanation and ranking/i);
    await userEvent.click(aiCheckbox);

    await userEvent.click(screen.getByRole('button', { name: /get meal recommendations/i }));

    await waitFor(() => {
      expect(capturedUrl).toContain('include_ai=true');
    });
  });

  it('16. AI explanation renders per-candidate AI note', async () => {
    const aiEnrichedItem: MealRecommendationItem = {
      ...mockMealItem1,
      ai_explanation: 'High leucine content from chicken breast promotes optimal muscle protein synthesis.',
      ai_rank: 1,
    };

    const aiEnrichedResponse: MealRecommendationResponse = {
      ...mockMealResponse,
      ai_used: true,
      ai_summary: 'Comprehensive high-protein lunch tailored for post-workout nutrition.',
      ai_considerations: ['Drink water', 'Eat 1 hour before training'],
      items: [aiEnrichedItem],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(aiEnrichedResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(
        screen.getByText(/high leucine content from chicken breast promotes optimal muscle protein synthesis/i),
      ).toBeInTheDocument();
      expect(screen.getByText('AI Rank #1')).toBeInTheDocument();
    });
  });

  it('17. AI summary and considerations render in AI panel', async () => {
    const aiEnrichedResponse: MealRecommendationResponse = {
      ...mockMealResponse,
      ai_used: true,
      ai_summary: 'Top meal selections optimized for your weight loss and muscle retention goals.',
      ai_considerations: [
        'Prioritize lean poultry for clean protein density',
        'Complex carbohydrates sustain blood glucose stability',
      ],
      items: [mockMealItem1],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(aiEnrichedResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /ai recommendation analysis/i })).toBeInTheDocument();
      expect(
        screen.getByText(/top meal selections optimized for your weight loss and muscle retention goals/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/prioritize lean poultry for clean protein density/i)).toBeInTheDocument();
      expect(screen.getByText(/complex carbohydrates sustain blood glucose stability/i)).toBeInTheDocument();
    });
  });

  it('18. AI fallback preserves deterministic recommendations', async () => {
    const aiFallbackResponse: MealRecommendationResponse = {
      ...mockMealResponse,
      ai_used: false,
      ai_fallback: true,
      metadata: { ai_fallback_reason: 'Provider timeout' },
      items: [mockMealItem1],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(aiFallbackResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      // Deterministic card is preserved
      expect(screen.getByText('High-Protein Chicken & Brown Rice Bowl')).toBeInTheDocument();
      // Informational status indicates fallback without error explosion
      expect(screen.getByRole('status', { name: /ai enrichment status/i })).toBeInTheDocument();
      expect(screen.getByText(/ai coaching unavailable/i)).toBeInTheDocument();
    });
  });

  it('19. AI fallback does not fabricate explanation', async () => {
    const aiFallbackResponse: MealRecommendationResponse = {
      ...mockMealResponse,
      ai_used: false,
      ai_fallback: true,
      items: [mockMealItem1],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(aiFallbackResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(screen.queryByText(/ai coaching note/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ai rank/i)).not.toBeInTheDocument();
    });
  });

  it('20. backend-provided AI ranking order is preserved as returned', async () => {
    const itemA: MealRecommendationItem = { ...mockMealItem2, id: 'item-a', name: 'Ranked First by AI', ai_rank: 1 };
    const itemB: MealRecommendationItem = { ...mockMealItem1, id: 'item-b', name: 'Ranked Second by AI', ai_rank: 2 };

    const rerankedResponse: MealRecommendationResponse = {
      ...mockMealResponse,
      ai_used: true,
      items: [itemA, itemB],
    };

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(rerankedResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      const articles = screen.getAllByRole('article');
      expect(articles.length).toBe(2);
      expect(within(articles[0]).getByText('Ranked First by AI')).toBeInTheDocument();
      expect(within(articles[0]).getByText('AI Rank #1')).toBeInTheDocument();
      expect(within(articles[1]).getByText('Ranked Second by AI')).toBeInTheDocument();
      expect(within(articles[1]).getByText('AI Rank #2')).toBeInTheDocument();
    });
  });

  // ==========================================
  // CONTRACT SAFETY & DISCLAIMER TESTS
  // ==========================================

  it('21. backend warning and disclaimer is displayed', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      expect(
        screen.getByText(
          /allergen and dietary filtering is based on food names and usda category metadata/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it('22. frontend does not calculate or alter nutrition values', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();

    await waitFor(() => {
      const group = screen.getByRole('group', { name: /nutritional totals/i });
      expect(within(group).getByText('495')).toBeInTheDocument();
      expect(within(group).getByText('66')).toBeInTheDocument();
      expect(within(group).getByText('35')).toBeInTheDocument();
      expect(within(group).getByText('8.5')).toBeInTheDocument();
    });
  });

  it('23. frontend does not calculate or alter workout programming values', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/meals')) {
        return new Response(JSON.stringify(mockMealResponse), { status: 200 });
      }
      if (url.includes('/api/v1/recommendations/workouts')) {
        return new Response(JSON.stringify(mockWorkoutResponse), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderRecommendationsPage();
    await userEvent.click(screen.getByRole('tab', { name: /workout recommendations/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/⏱ 45 min/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/7 sets \(2 exercises\)/i)).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText(/90s rest/i)).toBeInTheDocument();
    });
  });
});
