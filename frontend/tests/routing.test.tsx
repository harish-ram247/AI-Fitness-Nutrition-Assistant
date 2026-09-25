import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import App from '../src/App';

describe('Frontend Routing & Shell Tests', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. App renders without crashing', () => {
    render(<App />);
    expect(screen.getByText(/AI Fitness Assistant/i)).toBeInTheDocument();
  });

  it('2. Route shell loads with navigation links when authenticated', async () => {
    localStorage.setItem('fitness_access_token', 'valid-token');
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            id: 'u-1',
            email: 'demo@example.com',
            is_active: true,
            is_verified: true,
            created_at: '2026-09-24T00:00:00Z',
            updated_at: '2026-09-24T00:00:00Z',
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/nutrition/daily')) {
        return new Response(JSON.stringify({ totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }, meals: {} }), { status: 200 });
      }
      if (url.includes('/api/v1/progress/weight')) {
        return new Response(JSON.stringify({ entries: [], current_weight_kg: null, start_weight_kg: null, trend: 'no_data' }), { status: 200 });
      }
      if (url.includes('/api/v1/workouts')) {
        return new Response(JSON.stringify({ items: [] }), { status: 200 });
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
      expect(screen.getByRole('navigation', { name: /sidebar navigation|main navigation/i })).toBeInTheDocument();
    });

    const nav = screen.getByRole('navigation', { name: /sidebar navigation|main navigation/i });
    expect(screen.getByText(/AI Fitness & Nutrition Assistant/i)).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /profile/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /nutrition/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /workouts/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('user-email-display')).toHaveTextContent('demo@example.com');
    });
  });

  it('3. Public routes exist (/login and /register)', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
    unmount();

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
    });
  });

  it('4. Protected route infrastructure redirects to /login when unauthenticated', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Unauthenticated user attempting to access /dashboard must be redirected to /login
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/AI Fitness & Nutrition Assistant/i)).not.toBeInTheDocument();
  });

  it('4b. Protected routes render under AppLayout when authenticated', async () => {
    localStorage.setItem('fitness_access_token', 'valid-token');
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'u-1',
          email: 'demo@example.com',
          is_active: true,
          is_verified: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /nutrition & food logging/i })).toBeInTheDocument();
    });
  });

  it('10. Unknown route reaches 404 handling', () => {
    render(
      <MemoryRouter initialEntries={['/some-unknown-nonexistent-path']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to dashboard/i })).toBeInTheDocument();
  });
});
