import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import { ProfilePage } from '../src/features/profile/ProfilePage';
import type { UserProfileRead } from '../src/types/profile';
import type { UserPreferenceRead } from '../src/types/preferences';
import type { FitnessGoalRead, FitnessGoalListResponse } from '../src/types/goal';

describe('Phase 8D — Profile, Preferences & Goals Tests', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'u-12345',
    email: 'marcus@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  const mockProfile: UserProfileRead = {
    id: 'p-12345',
    user_id: 'u-12345',
    first_name: 'Marcus',
    last_name: 'Aurelius',
    date_of_birth: '1990-04-26',
    sex: 'male',
    height_cm: 178.5,
    current_weight_kg: 82.5,
    activity_level: 'moderately_active',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  const mockPreferences: UserPreferenceRead = {
    id: 'pref-12345',
    user_id: 'u-12345',
    unit_system: 'metric',
    calorie_target: 2400,
    protein_target_g: 160.0,
    carbs_target_g: 220.0,
    fat_target_g: 70.0,
    dietary_restrictions: ['gluten_free'],
    ai_persona: 'direct',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  };

  const mockGoals: FitnessGoalRead[] = [
    {
      id: 'g-1',
      user_id: 'u-12345',
      goal_type: 'weight_loss',
      description: 'Cut down to 78kg for summer',
      target_value: 78.0,
      target_unit: 'kg',
      target_date: '2026-08-01',
      status: 'active',
      completed_at: null,
      created_at: '2026-02-01T08:00:00Z',
      updated_at: '2026-02-01T08:00:00Z',
    },
    {
      id: 'g-2',
      user_id: 'u-12345',
      goal_type: 'strength',
      description: 'Bench press 100kg',
      target_value: 100.0,
      target_unit: 'kg',
      target_date: null,
      status: 'completed',
      completed_at: '2026-03-01T12:00:00Z',
      created_at: '2026-01-20T08:00:00Z',
      updated_at: '2026-03-01T12:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
    localStorage.setItem('fitness_access_token', 'valid-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupDefaultMocks = () => {
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      // Current user
      if (u.includes('/api/v1/users/me') || u.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }

      // Profile GET
      if (u.includes('/api/v1/profile/preferences') && method === 'GET') {
        return new Response(JSON.stringify(mockPreferences), { status: 200 });
      }

      if (u.includes('/api/v1/profile') && method === 'GET') {
        return new Response(JSON.stringify(mockProfile), { status: 200 });
      }

      // Goals GET
      if (u.includes('/api/v1/goals') && method === 'GET') {
        const urlObj = new URL(u, 'http://localhost');
        const statusParam = urlObj.searchParams.get('status');
        const filtered = statusParam
          ? mockGoals.filter((g) => g.status === statusParam)
          : mockGoals;
        const resp: FitnessGoalListResponse = { items: filtered, total: filtered.length };
        return new Response(JSON.stringify(resp), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });
  };

  /* ========================================================
     PROFILE TESTS (1 - 5)
     ======================================================== */

  it('1. profile page loads profile data', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Aurelius')).toBeInTheDocument();
      expect(screen.getByDisplayValue('178.5')).toBeInTheDocument();
      expect(screen.getByTestId('profile-current-weight')).toHaveTextContent('82.5 kg');
    });
  });

  it('2. profile loading state displays while fetching', async () => {
    let resolveProfile: (value: Response) => void = () => {};
    const pendingProfilePromise = new Promise<Response>((resolve) => {
      resolveProfile = resolve;
    });

    mockFetch.mockImplementation(async (url: string) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      if (u.includes('/api/v1/users/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (u.includes('/api/v1/profile/preferences')) {
        return new Response(JSON.stringify(mockPreferences), { status: 200 });
      }
      if (u.includes('/api/v1/goals')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (u.includes('/api/v1/profile')) {
        return pendingProfilePromise;
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('profile-loading')).toBeInTheDocument();

    // Resolve profile and ensure loading disappears
    resolveProfile(new Response(JSON.stringify(mockProfile), { status: 200 }));
    await waitFor(() => {
      expect(screen.queryByTestId('profile-loading')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
    });
  });

  it('3. profile save success updates state and shows confirmation banner', async () => {
    setupDefaultMocks();

    // Mock PUT /api/v1/profile response
    const updatedProfile: UserProfileRead = {
      ...mockProfile,
      first_name: 'Maximus',
      last_name: 'Decimus',
      height_cm: 182.0,
      activity_level: 'very_active',
    };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/goals')) return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });

      if (u.includes('/api/v1/profile') && method === 'GET') {
        return new Response(JSON.stringify(mockProfile), { status: 200 });
      }

      if (u.includes('/api/v1/profile') && method === 'PUT') {
        const body = JSON.parse(init?.body as string);
        expect(body.first_name).toBe('Maximus');
        expect(body.last_name).toBe('Decimus');
        return new Response(JSON.stringify(updatedProfile), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Maximus' } });
    fireEvent.change(lastNameInput, { target: { value: 'Decimus' } });

    const submitBtn = screen.getByRole('button', { name: /save profile changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/profile updated successfully/i);
      expect(screen.getByDisplayValue('Maximus')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Decimus')).toBeInTheDocument();
    });
  });

  it('4. profile save validation error catches invalid height and empty first name', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/first name/i);
    const heightInput = screen.getByLabelText(/height \(cm\)/i);

    // Empty first name and out-of-range height (350cm)
    fireEvent.change(firstNameInput, { target: { value: '   ' } });
    fireEvent.change(heightInput, { target: { value: '350' } });

    const submitBtn = screen.getByRole('button', { name: /save profile changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/height must be between 50 and 300 cm/i)).toBeInTheDocument();
    });
  });

  it('5. profile save server/network failure preserves entered values and shows error', async () => {
    setupDefaultMocks();

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/goals')) return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      if (u.includes('/api/v1/profile') && method === 'GET') {
        return new Response(JSON.stringify(mockProfile), { status: 200 });
      }

      if (u.includes('/api/v1/profile') && method === 'PUT') {
        return new Response(JSON.stringify({ detail: 'Database connection error during profile save' }), { status: 500 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
    });

    const firstNameInput = screen.getByLabelText(/first name/i);
    fireEvent.change(firstNameInput, { target: { value: 'Caesar' } });

    const submitBtn = screen.getByRole('button', { name: /save profile changes/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/database connection error/i);
      // Entered value preserved
      expect(screen.getByDisplayValue('Caesar')).toBeInTheDocument();
    });
  });

  /* ========================================================
     PREFERENCES TESTS (6 - 8)
     ======================================================== */

  it('6. preferences load and display current values', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('2400')).toBeInTheDocument();
      expect(screen.getByDisplayValue('160')).toBeInTheDocument();
      expect(screen.getByText(/gluten free/i)).toBeInTheDocument();
    });
  });

  it('7. preferences update success sends PATCH and shows success confirmation', async () => {
    setupDefaultMocks();

    const updatedPrefs: UserPreferenceRead = {
      ...mockPreferences,
      calorie_target: 2600,
      protein_target_g: 175.0,
      dietary_restrictions: ['gluten_free', 'dairy_free'],
      ai_persona: 'supportive',
    };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences') && method === 'GET') {
        return new Response(JSON.stringify(mockPreferences), { status: 200 });
      }
      if (u.includes('/api/v1/profile') && method === 'GET') return new Response(JSON.stringify(mockProfile), { status: 200 });
      if (u.includes('/api/v1/goals')) return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });

      if (u.includes('/api/v1/profile/preferences') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        expect(body.calorie_target).toBe(2600);
        return new Response(JSON.stringify(updatedPrefs), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('2400')).toBeInTheDocument();
    });

    const calInput = screen.getByLabelText(/calories \(kcal\)/i);
    fireEvent.change(calInput, { target: { value: '2600' } });

    // Toggle dairy_free restriction
    const dairyFreeBtn = screen.getByRole('button', { name: /\+ Dairy-Free/i });
    fireEvent.click(dairyFreeBtn);

    const submitBtn = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/preferences updated successfully/i);
      expect(screen.getByDisplayValue('2600')).toBeInTheDocument();
    });
  });

  it('8. preferences update validation catches invalid negative calorie targets', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('2400')).toBeInTheDocument();
    });

    const calInput = screen.getByLabelText(/calories \(kcal\)/i);
    fireEvent.change(calInput, { target: { value: '-500' } });

    const submitBtn = screen.getByRole('button', { name: /save preferences/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/calorie target must be a positive integer/i)).toBeInTheDocument();
    });
  });

  /* ========================================================
     GOALS TESTS (9 - 14, 17)
     ======================================================== */

  it('9. goals load and display items with types and targets', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
      expect(screen.getByText('Bench press 100kg')).toBeInTheDocument();
      expect(screen.getByTestId('goal-status-g-1')).toHaveTextContent('active');
      expect(screen.getByTestId('goal-status-g-2')).toHaveTextContent('completed');
    });
  });

  it('10. empty goals state renders message and call to action when no goals exist', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });
      if (u.includes('/api/v1/goals')) return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('goals-empty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create your first goal/i })).toBeInTheDocument();
    });
  });

  it('11. create goal opens modal, submits POST /api/v1/goals, and updates list', async () => {
    setupDefaultMocks();

    const newGoal: FitnessGoalRead = {
      id: 'g-new',
      user_id: 'u-12345',
      goal_type: 'endurance',
      description: 'Run 10km in under 50 minutes',
      target_value: 10.0,
      target_unit: 'km',
      target_date: '2026-10-15',
      status: 'active',
      completed_at: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });

      if (u.includes('/api/v1/goals') && method === 'GET') {
        return new Response(JSON.stringify({ items: mockGoals, total: mockGoals.length }), { status: 200 });
      }

      if (u.includes('/api/v1/goals') && method === 'POST') {
        const body = JSON.parse(init?.body as string);
        expect(body.goal_type).toBe('endurance');
        expect(body.description).toBe('Run 10km in under 50 minutes');
        return new Response(JSON.stringify(newGoal), { status: 201 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
    });

    // Click "+ Add New Goal" button
    const addBtn = screen.getByRole('button', { name: /\+ Add New Goal/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByRole('dialog', { name: /create new fitness goal/i })).toBeInTheDocument();

    const categorySelect = screen.getByLabelText(/goal category/i);
    fireEvent.change(categorySelect, { target: { value: 'endurance' } });

    const descInput = screen.getByLabelText(/description & notes/i);
    fireEvent.change(descInput, { target: { value: 'Run 10km in under 50 minutes' } });

    const valInput = screen.getByLabelText(/target value/i);
    fireEvent.change(valInput, { target: { value: '10' } });

    const submitGoalBtn = screen.getByRole('button', { name: /^create goal$/i });
    fireEvent.click(submitGoalBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Run 10km in under 50 minutes')).toBeInTheDocument();
    });
  });

  it('12. edit goal populates existing details and submits PATCH', async () => {
    setupDefaultMocks();

    const updatedGoal: FitnessGoalRead = {
      ...mockGoals[0],
      description: 'Revised target: 76kg by autumn',
      target_value: 76.0,
    };

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });

      if (u.includes('/api/v1/goals') && method === 'GET') {
        return new Response(JSON.stringify({ items: mockGoals, total: mockGoals.length }), { status: 200 });
      }

      if (u.includes('/api/v1/goals/g-1') && method === 'PATCH') {
        const body = JSON.parse(init?.body as string);
        expect(body.description).toBe('Revised target: 76kg by autumn');
        return new Response(JSON.stringify(updatedGoal), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
    });

    // Click edit on goal 1
    const editBtn = screen.getByRole('button', { name: /edit goal cut down to 78kg for summer/i });
    fireEvent.click(editBtn);

    expect(screen.getByRole('dialog', { name: /edit fitness goal/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cut down to 78kg for summer')).toBeInTheDocument();

    const descInput = screen.getByLabelText(/description & notes/i);
    fireEvent.change(descInput, { target: { value: 'Revised target: 76kg by autumn' } });

    const saveGoalBtn = screen.getByRole('button', { name: /^save goal$/i });
    fireEvent.click(saveGoalBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Revised target: 76kg by autumn')).toBeInTheDocument();
    });
  });

  it('13. delete goal prompts confirmation and deletes on confirm', async () => {
    setupDefaultMocks();

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });

      if (u.includes('/api/v1/goals') && method === 'GET') {
        return new Response(JSON.stringify({ items: mockGoals, total: mockGoals.length }), { status: 200 });
      }

      if (u.includes('/api/v1/goals/g-1') && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete goal cut down to 78kg for summer/i });
    fireEvent.click(deleteBtn);

    // Delete confirmation dialog is open
    expect(screen.getByRole('dialog', { name: /delete fitness goal/i })).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete the goal/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Cut down to 78kg for summer')).not.toBeInTheDocument();
      // Second goal remains
      expect(screen.getByText('Bench press 100kg')).toBeInTheDocument();
    });
  });

  it('14. failed delete preserves goal in UI and displays error message', async () => {
    setupDefaultMocks();

    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();
      const method = init?.method || 'GET';

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) return new Response(JSON.stringify(mockPreferences), { status: 200 });
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });

      if (u.includes('/api/v1/goals') && method === 'GET') {
        return new Response(JSON.stringify({ items: mockGoals, total: mockGoals.length }), { status: 200 });
      }

      if (u.includes('/api/v1/goals/g-1') && method === 'DELETE') {
        return new Response(JSON.stringify({ detail: 'Server error: unable to delete goal at this time' }), { status: 500 });
      }

      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: /delete goal cut down to 78kg for summer/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unable to delete goal/i);
    });

    // Dismiss modal and confirm goal is still in the list
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
  });

  /* ========================================================
     ROUTING & ACCESS TESTS (15 - 16)
     ======================================================== */

  it('15. /profile is protected and redirects unauthenticated users to /login', async () => {
    localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/profile & preferences/i)).not.toBeInTheDocument();
  });

  it('16. authenticated user can access /profile and see Account Identity and sections', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /profile & preferences/i })).toBeInTheDocument();
      expect(screen.getByTestId('account-email-value')).toHaveTextContent('marcus@example.com');
      expect(screen.getByText('✓ Verified Account')).toBeInTheDocument();
    });
  });

  /* ========================================================
     ADDITIONAL BEHAVIOR TESTS (17 - 18)
     ======================================================== */

  it('17. goal status filtering switches views between all and completed goals', async () => {
    setupDefaultMocks();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
      expect(screen.getByText('Bench press 100kg')).toBeInTheDocument();
    });

    // Click 'Completed' tab
    const completedTab = screen.getByRole('button', { name: /^completed$/i });
    fireEvent.click(completedTab);

    await waitFor(() => {
      expect(screen.queryByText('Cut down to 78kg for summer')).not.toBeInTheDocument();
      expect(screen.getByText('Bench press 100kg')).toBeInTheDocument();
    });
  });

  it('18. independent section failure isolation: preferences failure does not block profile and goals', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      const u = typeof url === 'string' ? url : (url as URL).toString();

      if (u.includes('/api/v1/users/me')) return new Response(JSON.stringify(mockUser), { status: 200 });
      if (u.includes('/api/v1/profile/preferences')) {
        return new Response(JSON.stringify({ detail: 'Preferences database offline' }), { status: 503 });
      }
      if (u.includes('/api/v1/profile')) return new Response(JSON.stringify(mockProfile), { status: 200 });
      if (u.includes('/api/v1/goals')) {
        return new Response(JSON.stringify({ items: mockGoals, total: mockGoals.length }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ProfilePage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      // Profile form rendered normally
      expect(screen.getByDisplayValue('Marcus')).toBeInTheDocument();
      // Goals rendered normally
      expect(screen.getByText('Cut down to 78kg for summer')).toBeInTheDocument();
      // Preferences shows error and retry button
      expect(screen.getByText(/preferences database offline/i)).toBeInTheDocument();
    });
  });
});
