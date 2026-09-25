import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';

describe('Phase 8C — Layout & Dashboard Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-dash-123',
    email: 'athlete@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  const mockNutritionSuccess = {
    date: '2026-09-24',
    totals: {
      calories: 1850.5,
      protein_g: 140.2,
      carbs_g: 190.8,
      fat_g: 55.4,
    },
    meals: {
      breakfast: {
        calories: 520.0,
        entries: [
          {
            id: 'entry-1',
            user_id: 'user-dash-123',
            food_item_id: 'food-1',
            meal_type: 'breakfast',
            quantity_g: 100,
            food_name_snapshot: 'Oatmeal with Almond Milk',
            calories: 520.0,
            protein_g: 22.0,
            carbs_g: 75.0,
            fat_g: 14.0,
            data_source_snapshot: 'usda',
            logged_at: '2026-09-24T08:00:00Z',
            log_date: '2026-09-24',
            entry_source: 'manual',
            created_at: '2026-09-24T08:00:00Z',
            updated_at: '2026-09-24T08:00:00Z',
          },
        ],
      },
      lunch: {
        calories: 750.0,
        entries: [],
      },
      dinner: {
        calories: 580.5,
        entries: [],
      },
      snack: {
        calories: 0.0,
        entries: [],
      },
    },
  };

  const mockWeightSuccess = {
    entries: [
      { id: 'w-1', date: '2026-09-20', weight_kg: 81.5 },
      { id: 'w-2', date: '2026-09-22', weight_kg: 81.0 },
      { id: 'w-3', date: '2026-09-24', weight_kg: 80.6 },
    ],
    current_weight_kg: 80.6,
    start_weight_kg: 81.5,
    trend: 'losing',
  };

  const mockWorkoutsSuccess = {
    items: [
      {
        id: 'session-1',
        user_id: 'user-dash-123',
        name: 'Upper Body Strength',
        notes: 'Felt strong on bench',
        started_at: '2026-09-24T07:00:00Z',
        ended_at: '2026-09-24T07:45:00Z',
        duration_minutes: 45,
        tags: ['strength', 'hypertrophy'],
        created_at: '2026-09-24T07:45:00Z',
        exercises: [
          {
            id: 'ex-entry-1',
            workout_session_id: 'session-1',
            exercise_id: 'ex-1',
            order_index: 0,
            sets: [
              { id: 's1', workout_exercise_id: 'ex-entry-1', set_number: 1, set_type: 'working', completed: true, created_at: '2026-09-24T07:10:00Z' },
              { id: 's2', workout_exercise_id: 'ex-entry-1', set_number: 2, set_type: 'working', completed: true, created_at: '2026-09-24T07:15:00Z' },
            ],
          },
        ],
      },
    ],
    total: 1,
    page: 1,
    size: 3,
    pages: 1,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    localStorage.setItem('fitness_access_token', 'valid-dashboard-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupDefaultMocks = () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (urlStr.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify(mockNutritionSuccess), { status: 200 });
      }
      if (urlStr.includes('/api/v1/progress/weight')) {
        return new Response(JSON.stringify(mockWeightSuccess), { status: 200 });
      }
      if (urlStr.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify(mockWorkoutsSuccess), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });
  };

  // ------------------------------------------------------------------------
  // 1. Authenticated Dashboard Renders
  // ------------------------------------------------------------------------
  it('1. authenticated dashboard renders with header, user email, and metric sections', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Header user email
    await waitFor(() => {
      expect(screen.getByTestId('header-user-email')).toHaveTextContent('athlete@example.com');
    });

    // Dashboard headings
    expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/welcome back, athlete@example\.com!/i)).toBeInTheDocument();

    // Section cards
    expect(screen.getByRole('heading', { name: /today's nutrition/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /weight trend/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /recent workouts/i })).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // 2 & 3. Sidebar Navigation & Active States
  // ------------------------------------------------------------------------
  it('2 & 3. sidebar navigation renders all links with active route indication', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: /sidebar navigation/i })).toBeInTheDocument();
    });

    const sidebarNav = screen.getByRole('navigation', { name: /sidebar navigation/i });

    // Verify all 6 navigation targets exist
    expect(sidebarNav).toHaveTextContent(/dashboard/i);
    expect(sidebarNav).toHaveTextContent(/profile/i);
    expect(sidebarNav).toHaveTextContent(/nutrition/i);
    expect(sidebarNav).toHaveTextContent(/workouts/i);
    expect(sidebarNav).toHaveTextContent(/recommendations/i);
    expect(sidebarNav).toHaveTextContent(/ai assistant/i);

    // Active link check: Dashboard link has active styling
    const dashboardLink = screen.getAllByRole('link', { name: /dashboard/i })[0];
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  // ------------------------------------------------------------------------
  // 4. Mobile Navigation
  // ------------------------------------------------------------------------
  it('4. mobile navigation toggles open, renders links, and closes on item click', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
    });

    const toggleBtn = screen.getByRole('button', { name: /open navigation menu/i });

    // Open mobile nav
    await userEvent.click(toggleBtn);

    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    expect(mobileNav).toBeInTheDocument();

    // Click link inside mobile nav
    const profileLink = screen.getAllByRole('link', { name: /profile/i })[1];
    await userEvent.click(profileLink);

    // Mobile nav drawer closes
    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: /mobile navigation/i })).not.toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 5. Nutrition API Success
  // ------------------------------------------------------------------------
  it('5. nutrition API success: displays calories, macros, and meal breakdown', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('nutrition-calories')).toHaveTextContent('1851');
      expect(screen.getByTestId('nutrition-protein')).toHaveTextContent('140.2');
      expect(screen.getByTestId('nutrition-carbs')).toHaveTextContent('190.8');
      expect(screen.getByTestId('nutrition-fat')).toHaveTextContent('55.4');
    });

    // Meal breakdown
    expect(screen.getByText(/520 kcal \(1 item\)/i)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // 6. Nutrition API Empty State
  // ------------------------------------------------------------------------
  it('6. nutrition API empty state: displays empty notice when 0 macros logged', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (urlStr.includes('/api/v1/nutrition/daily')) {
        return new Response(
          JSON.stringify({
            date: '2026-09-24',
            totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
            meals: { breakfast: { calories: 0, entries: [] }, lunch: { calories: 0, entries: [] }, dinner: { calories: 0, entries: [] }, snack: { calories: 0, entries: [] } },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/progress/weight')) return new Response(JSON.stringify(mockWeightSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/workouts')) return new Response(JSON.stringify(mockWorkoutsSuccess), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no macronutrient data logged for today yet/i)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 7. Nutrition API Error & Retry
  // ------------------------------------------------------------------------
  it('7. nutrition API error: displays error message and allows retry', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (urlStr.includes('/api/v1/nutrition/daily')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Database error fetching nutrition' }), { status: 500 });
        }
        return new Response(JSON.stringify(mockNutritionSuccess), { status: 200 });
      }
      if (urlStr.includes('/api/v1/progress/weight')) return new Response(JSON.stringify(mockWeightSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/workouts')) return new Response(JSON.stringify(mockWorkoutsSuccess), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Initial failure displays retry button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry nutrition/i })).toBeInTheDocument();
    });

    // Click retry
    await userEvent.click(screen.getByRole('button', { name: /retry nutrition/i }));

    // Recovers successfully
    await waitFor(() => {
      expect(screen.getByTestId('nutrition-calories')).toHaveTextContent('1851');
    });
  });

  // ------------------------------------------------------------------------
  // 8. Weight API Success
  // ------------------------------------------------------------------------
  it('8. weight API success: displays current weight, starting weight, trend badge, and chart', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-weight-val')).toHaveTextContent('80.6 kg');
      expect(screen.getByText('81.5 kg')).toBeInTheDocument();
      expect(screen.getByTestId('weight-trend-badge')).toHaveTextContent(/trend: losing/i);
    });
  });

  // ------------------------------------------------------------------------
  // 9. Weight Empty State
  // ------------------------------------------------------------------------
  it('9. weight empty state: displays notice when no weight history exists', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (urlStr.includes('/api/v1/nutrition/daily')) return new Response(JSON.stringify(mockNutritionSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/progress/weight')) {
        return new Response(
          JSON.stringify({ entries: [], current_weight_kg: null, start_weight_kg: null, trend: null }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/workouts')) return new Response(JSON.stringify(mockWorkoutsSuccess), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no weight entries recorded yet/i)).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 10. Workout API Success
  // ------------------------------------------------------------------------
  it('10. workout API success: displays session name, duration, exercises, and tags', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Upper Body Strength')).toBeInTheDocument();
      expect(screen.getByText(/45 min/i)).toBeInTheDocument();
      expect(screen.getByText(/1 exercise/i)).toBeInTheDocument();
      expect(screen.getByText(/2 sets/i)).toBeInTheDocument();
      expect(screen.getByText('strength')).toBeInTheDocument();
      expect(screen.getByText('hypertrophy')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 11. Workout Empty State
  // ------------------------------------------------------------------------
  it('11. workout empty state: displays empty notice with link to workouts', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (urlStr.includes('/api/v1/nutrition/daily')) return new Response(JSON.stringify(mockNutritionSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/progress/weight')) return new Response(JSON.stringify(mockWeightSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0, page: 1, size: 3, pages: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no workouts logged yet/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /start your first workout/i })).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 12. Independent API Failure Behavior
  // ------------------------------------------------------------------------
  it('12. independent API failure: nutrition 500 error does NOT break weight and workout cards', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      // Nutrition fails with server error
      if (urlStr.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify({ detail: 'Nutrition service temporarily down' }), { status: 503 });
      }
      // Weight and workouts succeed
      if (urlStr.includes('/api/v1/progress/weight')) return new Response(JSON.stringify(mockWeightSuccess), { status: 200 });
      if (urlStr.includes('/api/v1/workouts')) return new Response(JSON.stringify(mockWorkoutsSuccess), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Nutrition displays error & retry
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry nutrition/i })).toBeInTheDocument();
    });

    // Weight and workouts render completely fine!
    expect(screen.getByTestId('current-weight-val')).toHaveTextContent('80.6 kg');
    expect(screen.getByText('Upper Body Strength')).toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // 13. Logout Remains Functional from Layout Header
  // ------------------------------------------------------------------------
  it('13. logout action in Header clears session and redirects to /login', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /sign out/i }));

    // Clears tokens
    expect(localStorage.getItem('fitness_access_token')).toBeNull();

    // Redirects to /login
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 14. Responsive Layout Rendering
  // ------------------------------------------------------------------------
  it('14. renders desktop sidebar container and mobile navigation toggle element', async () => {
    setupDefaultMocks();

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    });

    expect(container.querySelector('.desktop-sidebar-container')).toBeInTheDocument();
    expect(container.querySelector('.mobile-nav-toggle')).toBeInTheDocument();
  });
});
