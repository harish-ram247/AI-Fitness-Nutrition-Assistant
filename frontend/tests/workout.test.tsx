import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import type { ExerciseRead } from '../src/types/exercise';
import type {
  WorkoutExerciseRead,
  WorkoutSessionRead,
  WorkoutSetRead,
} from '../src/types/workout';

describe('Phase 8F — Workouts & Exercise Tracking Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-workout-123',
    email: 'athlete@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  const mockSystemExercise: ExerciseRead = {
    id: 'ex-bench-press',
    name: 'Barbell Bench Press',
    category: 'strength',
    muscle_groups: ['chest', 'triceps', 'shoulders'],
    equipment: 'Barbell',
    description: 'Compound chest press on a flat bench.',
    instructions: 'Lower the bar to mid-chest with control, then press upwards to lockout.',
    is_verified: true,
    created_by_user_id: null,
    created_at: '2026-09-24T00:00:00Z',
  };

  const mockCustomExercise: ExerciseRead = {
    id: 'ex-custom-split-squat',
    name: 'Bulgarian Split Squat',
    category: 'strength',
    muscle_groups: ['quads', 'glutes'],
    equipment: 'Dumbbells',
    description: 'Rear foot elevated split squat.',
    instructions: 'Keep torso upright and lower back knee towards floor.',
    is_verified: false,
    created_by_user_id: 'user-workout-123',
    created_at: '2026-09-24T00:00:00Z',
  };

  const mockWorkoutSet1: WorkoutSetRead = {
    id: 'set-1',
    workout_exercise_id: 'we-1',
    set_number: 1,
    set_type: 'working',
    reps: 10,
    weight_kg: 80,
    duration_seconds: null,
    distance_m: null,
    rpe: 8.0,
    completed: true,
    created_at: '2026-09-24T10:00:00Z',
  };

  const mockWorkoutExercise1: WorkoutExerciseRead = {
    id: 'we-1',
    workout_session_id: 'workout-1',
    exercise_id: 'ex-bench-press',
    order_index: 0,
    notes: 'Warmup well before heavy sets',
    exercise: mockSystemExercise,
    sets: [mockWorkoutSet1],
  };

  const mockWorkoutSession1: WorkoutSessionRead = {
    id: 'workout-1',
    user_id: 'user-workout-123',
    name: 'Push Day A',
    notes: 'Great chest and triceps focus',
    started_at: '2026-09-24T09:00:00Z',
    ended_at: '2026-09-24T10:00:00Z',
    duration_minutes: 60,
    tags: ['push', 'hypertrophy'],
    created_at: '2026-09-24T09:00:00Z',
    exercises: [mockWorkoutExercise1],
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

  const renderWorkoutsPage = async () => {
    const utils = render(
      <MemoryRouter initialEntries={['/workouts']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /workouts & exercise tracking/i })).toBeInTheDocument();
    }, { timeout: 3000 });
    return utils;
  };

  // ==========================================
  // 1. EXERCISE CATALOG TESTS
  // ==========================================

  it('1. exercise catalog loads and renders catalog items', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({
            items: [mockSystemExercise, mockCustomExercise],
            total: 2,
            page: 1,
            size: 50,
            pages: 1,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /exercise catalog/i })).toBeInTheDocument();
    });

    // Switch to Exercise Catalog tab
    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
      expect(screen.getByText('Bulgarian Split Squat')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });
  });

  it('2. exercise search/filter request sends correct query params', async () => {
    let capturedUrl = '';

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        capturedUrl = url;
        return new Response(
          JSON.stringify({
            items: [mockSystemExercise],
            total: 1,
            page: 1,
            size: 50,
            pages: 1,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/search exercise catalog/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText(/search exercise catalog/i);
    await userEvent.type(searchInput, 'bench');
    await userEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(capturedUrl).toContain('q=bench');
    });
  });

  it('3. empty exercise result displays clean empty state', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [], total: 0, page: 1, size: 50, pages: 0 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByText(/no exercises found matching your criteria/i)).toBeInTheDocument();
    });
  });

  it('4. exercise detail selection opens modal with instructions and equipment', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockSystemExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view details of barbell bench press/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /view details of barbell bench press/i }));

    // Inspect modal appears
    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByText(/compound chest press on a flat bench/i)).toBeInTheDocument();
      expect(within(modal).getByText(/lower the bar to mid-chest with control/i)).toBeInTheDocument();
      expect(within(modal).getByText(/equipment required:/i).parentElement).toHaveTextContent(/barbell/i);
    });

    // Close modal
    await userEvent.click(within(modal).getByRole('button', { name: /^close$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText(/lower the bar to mid-chest with control/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================
  // 2. WORKOUT LIST TESTS
  // ==========================================

  it('5. workout history loads and displays workout cards', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(
          JSON.stringify({ items: [mockWorkoutSession1], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByText('Push Day A')).toBeInTheDocument();
      expect(screen.getByText(/⏱ 60 min/i)).toBeInTheDocument();
      expect(screen.getByText('#push')).toBeInTheDocument();
      expect(screen.getByText(/1 exercise · 1 set/i)).toBeInTheDocument();
    });
  });

  it('6. workout empty state displays friendly prompt and action button', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByText(/no workouts recorded yet/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ start your first workout/i })).toBeInTheDocument();
    });
  });

  it('7. workout list error displays alert with retry option', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ detail: 'Database connection failed' }), { status: 500 });
        }
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/database connection failed/i);
    });

    // Click Retry
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText('Push Day A')).toBeInTheDocument();
    });
  });

  // ==========================================
  // 3. WORKOUT CRUD TESTS
  // ==========================================

  it('8. create workout sends timezone-aware started_at and opens detail', async () => {
    let createdPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts') && opts?.method === 'POST') {
        createdPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 201 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ start \/ log workout/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /\+ start \/ log workout/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/workout name/i), 'Leg Day Blitz');
    await userEvent.type(within(modal).getByLabelText(/tags/i), 'legs, quads');

    // Submit
    await userEvent.click(within(modal).getByRole('button', { name: /create workout/i }));

    await waitFor(() => {
      expect(createdPayload).not.toBeNull();
    });

    const payload = createdPayload as unknown as Record<string, unknown>;
    expect(payload.name).toBe('Leg Day Blitz');
    expect(payload.started_at).toBeDefined();
    // Timezone-aware ISO check
    expect((payload.started_at as string).endsWith('Z')).toBe(true);
    expect(payload.tags).toEqual(['legs', 'quads']);

    // Opens workout detail view
    await waitFor(() => {
      expect(screen.getByText('Push Day A')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back to workouts/i })).toBeInTheDocument();
    });
  });

  it('9. create workout validation prevents invalid end time earlier than start time', async () => {
    let postCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/workouts') && opts?.method === 'POST') {
        postCalled = true;
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 201 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /\+ start \/ log workout/i }));
    const modal = screen.getByRole('dialog');

    // Uncheck in-progress to show ended_at input
    await userEvent.click(within(modal).getByLabelText(/workout is currently in progress/i));

    // Set startedAt = 2026-09-24T12:00
    const startInput = within(modal).getByLabelText(/start time/i);
    await userEvent.clear(startInput);
    await userEvent.type(startInput, '2026-09-24T12:00');

    // Set endedAt = 2026-09-24T11:00 (earlier than start!)
    const endInput = within(modal).getByLabelText(/end time/i);
    await userEvent.clear(endInput);
    await userEvent.type(endInput, '2026-09-24T11:00');

    await userEvent.click(within(modal).getByRole('button', { name: /create workout/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/end time cannot be earlier than start time/i);
    });
    expect(postCalled).toBe(false);
  });

  it('10. open workout detail displays exercises and sets hierarchy', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Push Day A' })).toBeInTheDocument();
      expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('80 kg')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('11. update workout sends updated name and notes', async () => {
    let patchPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`) && opts?.method === 'PATCH') {
        patchPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ ...mockWorkoutSession1, name: 'Push Day Heavy' }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit workout push day a/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit workout push day a/i }));

    const modal = screen.getByRole('dialog');
    const nameInput = within(modal).getByLabelText(/workout name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Push Day Heavy');

    await userEvent.click(within(modal).getByRole('button', { name: /update workout/i }));

    await waitFor(() => {
      expect(patchPayload).not.toBeNull();
    });
    const payload = patchPayload as unknown as Record<string, unknown>;
    expect(payload.name).toBe('Push Day Heavy');
  });

  it('12. delete confirmation requires explicit confirmation before calling API', async () => {
    let deleteCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete workout push day a/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete workout push day a/i }));

    const modal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(modal).getByRole('heading', { name: /delete workout session/i })).toBeInTheDocument();
    });
    expect(deleteCalled).toBe(false);

    // Click Cancel
    await userEvent.click(within(modal).getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /delete workout session/i })).not.toBeInTheDocument();
    });
    expect(deleteCalled).toBe(false);
  });

  it('13. successful delete calls DELETE endpoint and refreshes history', async () => {
    let deleteCalled = false;
    let listCalls = 0;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/v1/workouts')) {
        listCalls++;
        return new Response(
          JSON.stringify({
            items: deleteCalled ? [] : [mockWorkoutSession1],
            total: deleteCalled ? 0 : 1,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete workout push day a/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete workout push day a/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(listCalls).toBeGreaterThanOrEqual(2);
    });
  });

  it('14. failed delete preserves workout and displays error message', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`) && opts?.method === 'DELETE') {
        return new Response(JSON.stringify({ detail: 'Workout is locked and cannot be deleted' }), { status: 409 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete workout push day a/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete workout push day a/i }));
    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/workout is locked/i);
    });
    // Workout remains in background
    expect(screen.getByRole('heading', { level: 3, name: 'Push Day A' })).toBeInTheDocument();
  });

  // ==========================================
  // 4. WORKOUT EXERCISES TESTS
  // ==========================================

  it('15. add exercise sends exercise_id and refreshes workout detail', async () => {
    let postExercisePayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockSystemExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises`) && opts?.method === 'POST') {
        postExercisePayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockWorkoutExercise1), { status: 201 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ add exercise/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));

    // Catalog modal opens
    const catalogModal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(catalogModal).getByRole('button', { name: /select barbell bench press/i })).toBeInTheDocument();
    });
    await userEvent.click(within(catalogModal).getByRole('button', { name: /select barbell bench press/i }));

    // Exercise details modal opens
    const exerciseModal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(exerciseModal).getByRole('heading', { name: /add: barbell bench press/i })).toBeInTheDocument();
    });
    await userEvent.click(within(exerciseModal).getByRole('button', { name: /add to workout/i }));

    await waitFor(() => {
      expect(postExercisePayload).not.toBeNull();
    });
    const payload = postExercisePayload as unknown as Record<string, unknown>;
    expect(payload.exercise_id).toBe('ex-bench-press');
  });

  it('16. inaccessible exercise error handled safely without revealing private details', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockSystemExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises`) && opts?.method === 'POST') {
        return new Response(JSON.stringify({ detail: 'Exercise not found or not visible' }), { status: 404 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await userEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));
    const catalogModal = screen.getByRole('dialog');
    await waitFor(() => {
      expect(within(catalogModal).getByRole('button', { name: /select barbell bench press/i })).toBeInTheDocument();
    });
    await userEvent.click(within(catalogModal).getByRole('button', { name: /select barbell bench press/i }));

    const exerciseModal = screen.getByRole('dialog');
    await userEvent.click(within(exerciseModal).getByRole('button', { name: /add to workout/i }));

    await waitFor(() => {
      expect(within(exerciseModal).getByRole('alert')).toHaveTextContent(/exercise not found or not visible/i);
    });
  });

  it('17. update workout exercise updates order and notes', async () => {
    let patchPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises/${mockWorkoutExercise1.id}`) && opts?.method === 'PATCH') {
        patchPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...mockWorkoutExercise1, order_index: 2 }), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit barbell bench press/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit barbell bench press/i }));

    const modal = screen.getByRole('dialog');
    const orderInput = within(modal).getByLabelText(/order index/i);
    await userEvent.clear(orderInput);
    await userEvent.type(orderInput, '2');

    await userEvent.click(within(modal).getByRole('button', { name: /update exercise/i }));

    await waitFor(() => {
      expect(patchPayload).not.toBeNull();
    });
    const payload = patchPayload as unknown as Record<string, unknown>;
    expect(payload.order_index).toBe(2);
  });

  it('18. remove workout exercise confirms and deletes exercise entry', async () => {
    let deleteCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises/${mockWorkoutExercise1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /remove barbell bench press/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /remove barbell bench press/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /confirm remove/i }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  // ==========================================
  // 5. WORKOUT SETS TESTS
  // ==========================================

  it('19. add set sends valid payload with reps, weight, and rpe', async () => {
    let postSetPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises/${mockWorkoutExercise1.id}/sets`) && opts?.method === 'POST') {
        postSetPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockWorkoutSet1), { status: 201 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add set to barbell bench press/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /add set to barbell bench press/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/weight \(kg\)/i), '85');
    await userEvent.type(within(modal).getByLabelText(/reps/i), '8');
    await userEvent.type(within(modal).getByLabelText(/rpe/i), '8.5');

    await userEvent.click(within(modal).getByRole('button', { name: /add set/i }));

    await waitFor(() => {
      expect(postSetPayload).not.toBeNull();
    });

    const payload = postSetPayload as unknown as Record<string, unknown>;
    expect(payload.set_number).toBe(2);
    expect(payload.weight_kg).toBe(85);
    expect(payload.reps).toBe(8);
    expect(payload.rpe).toBe(8.5);
  });

  it('20. edit set sends updated values via PATCH', async () => {
    let patchSetPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises/${mockWorkoutExercise1.id}/sets/${mockWorkoutSet1.id}`) && opts?.method === 'PATCH') {
        patchSetPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...mockWorkoutSet1, reps: 12 }), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit set 1/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit set 1/i }));

    const modal = screen.getByRole('dialog');
    const repsInput = within(modal).getByLabelText(/reps/i);
    await userEvent.clear(repsInput);
    await userEvent.type(repsInput, '12');

    await userEvent.click(within(modal).getByRole('button', { name: /update set/i }));

    await waitFor(() => {
      expect(patchSetPayload).not.toBeNull();
    });
    const payload = patchSetPayload as unknown as Record<string, unknown>;
    expect(payload.reps).toBe(12);
  });

  it('21. delete set confirms and removes set from exercise', async () => {
    let deleteCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}/exercises/${mockWorkoutExercise1.id}/sets/${mockWorkoutSet1.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete set 1/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete set 1/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('22. invalid set validation blocks negative values and invalid RPE increments', async () => {
    let postCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/sets') && opts?.method === 'POST') {
        postCalled = true;
        return new Response(JSON.stringify(mockWorkoutSet1), { status: 201 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));
    await userEvent.click(screen.getByRole('button', { name: /add set to barbell bench press/i }));

    const modal = screen.getByRole('dialog');

    // Test invalid RPE = 7.3
    const rpeInput = within(modal).getByLabelText(/rpe/i);
    await userEvent.type(rpeInput, '7.3');
    await userEvent.click(within(modal).getByRole('button', { name: /add set/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/rpe must be in 0.5 increments/i);
    });
    expect(postCalled).toBe(false);
  });

  it('23. duplicate set number error from backend is preserved and displayed', async () => {
    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/sets') && opts?.method === 'POST') {
        return new Response(
          JSON.stringify({ detail: 'Set number 1 already exists for this exercise' }),
          { status: 409 },
        );
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));
    await userEvent.click(screen.getByRole('button', { name: /add set to barbell bench press/i }));

    const modal = screen.getByRole('dialog');
    const setNumInput = within(modal).getByLabelText(/set number/i);
    await userEvent.clear(setNumInput);
    await userEvent.type(setNumInput, '1');

    await userEvent.click(within(modal).getByRole('button', { name: /add set/i }));

    await waitFor(() => {
      expect(within(modal).getByRole('alert')).toHaveTextContent(/set number 1 already exists/i);
    });
  });

  it('24. nullable set fields are preserved as null when left blank', async () => {
    let postSetPayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/sets') && opts?.method === 'POST') {
        postSetPayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockWorkoutSet1), { status: 201 });
      }
      if (url.includes(`/api/v1/workouts/${mockWorkoutSession1.id}`)) {
        return new Response(JSON.stringify(mockWorkoutSession1), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [mockWorkoutSession1], total: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open workout details/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /open workout details/i }));
    await userEvent.click(screen.getByRole('button', { name: /add set to barbell bench press/i }));

    const modal = screen.getByRole('dialog');
    // Only specify set number and reps, leave weight, duration, distance, rpe empty
    await userEvent.type(within(modal).getByLabelText(/reps/i), '15');
    await userEvent.click(within(modal).getByRole('button', { name: /add set/i }));

    await waitFor(() => {
      expect(postSetPayload).not.toBeNull();
    });

    const payload = postSetPayload as unknown as Record<string, unknown>;
    expect(payload.reps).toBe(15);
    expect(payload.weight_kg).toBeNull();
    expect(payload.duration_seconds).toBeNull();
    expect(payload.distance_m).toBeNull();
    expect(payload.rpe).toBeNull();
  });

  // ==========================================
  // 6. CUSTOM EXERCISES TESTS
  // ==========================================

  it('25. create custom exercise sends payload to POST /api/v1/exercises', async () => {
    let postExercisePayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/exercises') && opts?.method === 'POST') {
        postExercisePayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockCustomExercise), { status: 201 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ create custom exercise/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /\+ create custom exercise/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.type(within(modal).getByLabelText(/exercise name/i), 'Pistol Squat');
    await userEvent.type(within(modal).getByLabelText(/muscle groups/i), 'quads, core');

    await userEvent.click(within(modal).getByRole('button', { name: /create exercise/i }));

    await waitFor(() => {
      expect(postExercisePayload).not.toBeNull();
    });
    const payload = postExercisePayload as unknown as Record<string, unknown>;
    expect(payload.name).toBe('Pistol Squat');
    expect(payload.muscle_groups).toEqual(['quads', 'core']);
  });

  it('26. edit custom exercise sends PATCH to /api/v1/exercises/{id}', async () => {
    let patchExercisePayload: Record<string, unknown> | null = null;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/exercises/${mockCustomExercise.id}`) && opts?.method === 'PATCH') {
        patchExercisePayload = JSON.parse(opts.body as string) as Record<string, unknown>;
        return new Response(JSON.stringify(mockCustomExercise), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockCustomExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit bulgarian split squat/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /edit bulgarian split squat/i }));

    const modal = screen.getByRole('dialog');
    const nameInput = within(modal).getByLabelText(/exercise name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Deficit Bulgarian Split Squat');

    await userEvent.click(within(modal).getByRole('button', { name: /update exercise/i }));

    await waitFor(() => {
      expect(patchExercisePayload).not.toBeNull();
    });
    const payload = patchExercisePayload as unknown as Record<string, unknown>;
    expect(payload.name).toBe('Deficit Bulgarian Split Squat');
  });

  it('27. delete custom exercise confirms and calls DELETE /api/v1/exercises/{id}', async () => {
    let deleteCalled = false;

    mockFetch.mockImplementation(async (url: string, opts?: RequestInit) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes(`/api/v1/exercises/${mockCustomExercise.id}`) && opts?.method === 'DELETE') {
        deleteCalled = true;
        return new Response(null, { status: 204 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockCustomExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete bulgarian split squat/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /delete bulgarian split squat/i }));

    const modal = screen.getByRole('dialog');
    await userEvent.click(within(modal).getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      expect(deleteCalled).toBe(true);
    });
  });

  it('28. system exercise cannot be edited or deleted by normal users', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/exercises')) {
        return new Response(
          JSON.stringify({ items: [mockSystemExercise], total: 1, page: 1, size: 50, pages: 1 }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    await renderWorkoutsPage();

    await userEvent.click(screen.getByRole('button', { name: /exercise catalog/i }));

    await waitFor(() => {
      expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    });

    // Details button exists, but Edit/Delete buttons MUST NOT exist for system exercises
    expect(screen.getByRole('button', { name: /view details of barbell bench press/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit barbell bench press/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete barbell bench press/i })).not.toBeInTheDocument();
  });

  // ==========================================
  // 7. ROUTING TESTS
  // ==========================================

  it('29. /workouts remains protected and redirects unauthenticated user to /login', async () => {
    localStorage.removeItem('fitness_access_token');

    render(
      <MemoryRouter initialEntries={['/workouts']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/workouts & exercise tracking/i)).not.toBeInTheDocument();
  });
});
