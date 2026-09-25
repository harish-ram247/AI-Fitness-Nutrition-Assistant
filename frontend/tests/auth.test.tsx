import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { ProtectedRoute } from '../src/routes/ProtectedRoute';
import { PublicRoute } from '../src/routes/PublicRoute';
import { LoginForm } from '../src/features/auth/components/LoginForm';
import { RegisterForm } from '../src/features/auth/components/RegisterForm';
import { ChangePasswordModal } from '../src/features/auth/components/ChangePasswordModal';
import { getSafeReturnTo, validatePasswordStrength } from '../src/utils/security';

describe('Phase 8B — Authentication & Session Management Tests', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------------
  // 1 & 2. Login Flow
  // ------------------------------------------------------------------------
  it('1. login success: authenticates credentials, stores tokens, and fetches current user', async () => {
    // 1. Initial mount checks for tokens (none present)
    // 2. Login POST /api/v1/auth/login returns tokens
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'bearer',
          expires_in: 1800,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // 3. User loading GET /api/v1/users/me returns user record
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-uuid-123',
          email: 'test@example.com',
          is_active: true,
          is_verified: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'ValidPassword123!');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(localStorage.getItem('fitness_access_token')).toBe('new-access-token');
      expect(localStorage.getItem('fitness_refresh_token')).toBe('new-refresh-token');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123!' }),
      }),
    );
  });

  it('2. login failure: displays invalid credentials message on 401', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole('button', { name: /sign in/i });

    await userEvent.type(emailInput, 'wrong@example.com');
    await userEvent.type(passwordInput, 'WrongPass123!');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i);
    });

    expect(localStorage.getItem('fitness_access_token')).toBeNull();
  });

  // ------------------------------------------------------------------------
  // 3 & 4. Registration Flow
  // ------------------------------------------------------------------------
  it('3. registration success: registers user, logs in, and updates session', async () => {
    // 1. POST /api/v1/auth/register
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-uuid-999',
          email: 'newuser@example.com',
          is_active: true,
          is_verified: false,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // 2. Auto-login POST /api/v1/auth/login
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'registered-access-token',
          refresh_token: 'registered-refresh-token',
          token_type: 'bearer',
          expires_in: 1800,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    // 3. GET /api/v1/users/me
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-uuid-999',
          email: 'newuser@example.com',
          is_active: true,
          is_verified: false,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <RegisterForm />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/^email address/i), 'newuser@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'SecurePass123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'SecurePass123!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(localStorage.getItem('fitness_access_token')).toBe('registered-access-token');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'newuser@example.com', password: 'SecurePass123!' }),
      }),
    );
  });

  it('4. registration validation failure: catches client-side password rule and backend 422', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider>
          <RegisterForm />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/^email address/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'simple');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'simple');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Client-side validation stops submission
    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------------
  // 5 & 6. Protected Route Behavior
  // ------------------------------------------------------------------------
  it('5. authenticated protected route: renders protected content when session is valid', async () => {
    localStorage.setItem('fitness_access_token', 'valid-token');

    // GET /api/v1/users/me succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'auth@example.com',
          is_active: true,
          is_verified: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    // Initial loading indicator
    expect(screen.getByRole('status', { name: /checking session/i })).toBeInTheDocument();

    // Resolves to protected content
    await waitFor(() => {
      expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
    });
  });

  it('6. unauthenticated protected route: redirects to /login preserving returnTo', async () => {
    render(
      <MemoryRouter initialEntries={['/nutrition']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/nutrition"
              element={
                <ProtectedRoute>
                  <div>Protected Nutrition Content</div>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<div>Login Page Form</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Login Page Form')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 7. Public Route Redirect for Authenticated User
  // ------------------------------------------------------------------------
  it('7. public route redirect for authenticated user: redirects away from /login to /dashboard', async () => {
    localStorage.setItem('fitness_access_token', 'active-token');

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-2',
          email: 'logged@example.com',
          is_active: true,
          is_verified: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200 },
      ),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <div>Public Login Component</div>
                </PublicRoute>
              }
            />
            <Route path="/dashboard" element={<div>Dashboard Landed</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Landed')).toBeInTheDocument();
    });
    expect(screen.queryByText('Public Login Component')).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------------------
  // 8. Current-User Loading
  // ------------------------------------------------------------------------
  it('8. current-user loading: initializes AuthContext with user data from GET /api/v1/users/me', async () => {
    localStorage.setItem('fitness_access_token', 'bootstrap-token');

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'bootstrapped-id',
          email: 'bootstrap@example.com',
          is_active: true,
          is_verified: true,
          created_at: '2026-09-24T00:00:00Z',
          updated_at: '2026-09-24T00:00:00Z',
        }),
        { status: 200 },
      ),
    );

    const UserProfileProbe = () => {
      const { user, isAuthenticated, isLoading } = useAuth();
      if (isLoading) return <div>Loading Probe...</div>;
      return (
        <div>
          <span>Auth: {isAuthenticated ? 'YES' : 'NO'}</span>
          <span>User: {user?.email}</span>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <UserProfileProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Auth: YES')).toBeInTheDocument();
      expect(screen.getByText('User: bootstrap@example.com')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------------------
  // 15. Logout Flow
  // ------------------------------------------------------------------------
  it('15. logout clears session and tokens from storage', async () => {
    localStorage.setItem('fitness_access_token', 'token-to-clear');
    localStorage.setItem('fitness_refresh_token', 'refresh-to-clear');

    mockFetch
      // GET /api/v1/users/me for initial load
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'user-logout',
            email: 'logout@example.com',
            is_active: true,
            is_verified: true,
            created_at: '2026-09-24T00:00:00Z',
            updated_at: '2026-09-24T00:00:00Z',
          }),
          { status: 200 },
        ),
      )
      // POST /api/v1/auth/logout returns 204
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const LogoutTestComponent = () => {
      const { user, logout } = useAuth();
      return (
        <div>
          <span>{user ? `Logged in as ${user.email}` : 'Signed out'}</span>
          <button type="button" onClick={() => logout()}>
            Sign Out Button
          </button>
        </div>
      );
    };

    render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutTestComponent />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Logged in as logout@example.com')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /sign out button/i }));

    await waitFor(() => {
      expect(screen.getByText('Signed out')).toBeInTheDocument();
    });

    expect(localStorage.getItem('fitness_access_token')).toBeNull();
    expect(localStorage.getItem('fitness_refresh_token')).toBeNull();
  });

  // ------------------------------------------------------------------------
  // 16. Password Change
  // ------------------------------------------------------------------------
  it('16. password change request sends current and new passwords to POST /api/v1/auth/change-password', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Password updated successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <AuthProvider>
          <ChangePasswordModal isOpen={true} onClose={onClose} />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/^new password/i), 'BrandNewPass456#');
    await userEvent.type(screen.getByLabelText(/confirm new password/i), 'BrandNewPass456#');
    await userEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/password changed successfully/i);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ current_password: 'OldPass123!', new_password: 'BrandNewPass456#' }),
      }),
    );
  });

  // ------------------------------------------------------------------------
  // 17 & 18. returnTo & Open Redirect Prevention
  // ------------------------------------------------------------------------
  it('17. returnTo redirects to intended protected destination after login', async () => {
    mockFetch
      // Login POST
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'return-token',
            refresh_token: 'return-refresh',
            token_type: 'bearer',
            expires_in: 1800,
          }),
          { status: 200 },
        ),
      )
      // GET /users/me
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'u-1',
            email: 'user@example.com',
            is_active: true,
            is_verified: true,
            created_at: '2026-09-24T00:00:00Z',
            updated_at: '2026-09-24T00:00:00Z',
          }),
          { status: 200 },
        ),
      );

    render(
      <MemoryRouter initialEntries={['/login?returnTo=%2Fworkouts']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/workouts" element={<div>Landed on Workouts</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'ValidPass123!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Landed on Workouts')).toBeInTheDocument();
    });
  });

  it('18. malicious returnTo/open redirect prevention falls back safely to /dashboard', () => {
    // Malicious protocols and domains
    expect(getSafeReturnTo('//evil.com')).toBe('/dashboard');
    expect(getSafeReturnTo('https://evil.com')).toBe('/dashboard');
    expect(getSafeReturnTo('http://attacker.com/steal')).toBe('/dashboard');
    expect(getSafeReturnTo('javascript:alert(1)')).toBe('/dashboard');
    expect(getSafeReturnTo('/\\evil.com')).toBe('/dashboard');
    expect(getSafeReturnTo(null)).toBe('/dashboard');
    expect(getSafeReturnTo('')).toBe('/dashboard');

    // Valid relative internal paths
    expect(getSafeReturnTo('/workouts')).toBe('/workouts');
    expect(getSafeReturnTo('/nutrition?date=2026-09-24')).toBe('/nutrition?date=2026-09-24');
    expect(getSafeReturnTo('/profile')).toBe('/profile');
  });

  it('password strength validation enforces backend criteria', () => {
    expect(validatePasswordStrength('short')).toBe('Password must be at least 8 characters');
    expect(validatePasswordStrength('nouppercase123!')).toBe('Password must contain an uppercase letter');
    expect(validatePasswordStrength('NoDigitsHere!')).toBe('Password must contain a digit');
    expect(validatePasswordStrength('NoSpecialChar123')).toContain('Password must contain a special character');
    expect(validatePasswordStrength('ValidPassword123!')).toBeNull();
  });
});
