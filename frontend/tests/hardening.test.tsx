import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/context/AuthContext';
import { AppRoutes } from '../src/routes/AppRoutes';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { AppLayout } from '../src/layouts/AppLayout';
import { getSafeReturnTo, validatePasswordStrength } from '../src/utils/security';
import { ChatMessageItem } from '../src/features/ai/components/ChatMessageItem';
import { DeleteConversationModal } from '../src/features/ai/components/DeleteConversationModal';
import { VALID_WORKOUT_TYPES } from '../src/types/recommendation';

// Component that throws on demand to test Error Boundary
const BombComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Fatal rendering crash for test');
  }
  return <div>Component rendered safely</div>;
};

describe('Phase 8I — Testing, Accessibility & Production Build Polish', () => {
  const mockFetch = vi.fn();

  const mockUser = {
    id: 'user-hardening-1',
    email: 'hardening@example.com',
    is_active: true,
    is_verified: true,
    created_at: '2026-09-24T00:00:00Z',
    updated_at: '2026-09-24T00:00:00Z',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1 & 2. ERROR BOUNDARY TESTS
  // =========================================================================

  it('1. Error Boundary catches unhandled render error and renders friendly fallback without stack trace', () => {
    // Suppress console.error in test output for expected error boundary test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Verify raw error stack trace is not dumped to user
    expect(screen.queryByText(/Fatal rendering crash for test/i)).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('2. Error Boundary recovery action triggers onReset callback', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onResetMock = vi.fn();

    render(
      <ErrorBoundary onReset={onResetMock}>
        <BombComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(tryAgainBtn);

    expect(onResetMock).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
  });

  // =========================================================================
  // 3 & 4. ROUTE PROTECTION & PUBLIC ROUTE AUDIT
  // =========================================================================

  it('3. protected route redirects unauthenticated user to login', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    });
  });

  it('4. public route allows unauthenticated access and redirects authenticated user to dashboard', async () => {
    // A. Unauthenticated access to /login
    const { unmount } = render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    unmount();

    // B. Authenticated user accessing /login redirects to /dashboard
    localStorage.setItem('fitness_access_token', 'valid-test-token');
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. OPEN REDIRECT / SAFE RETURNO AUDIT
  // =========================================================================

  it('5. safe returnTo utility sanitizes open redirect exploits and preserves valid paths', () => {
    // Valid internal paths
    expect(getSafeReturnTo('/dashboard')).toBe('/dashboard');
    expect(getSafeReturnTo('/nutrition?date=2026-09-24')).toBe('/nutrition?date=2026-09-24');
    expect(getSafeReturnTo('/workouts/session-123')).toBe('/workouts/session-123');

    // Protocol-relative URLs (open redirect vector)
    expect(getSafeReturnTo('//evil.example.com')).toBe('/dashboard');
    expect(getSafeReturnTo('/\\evil.example.com')).toBe('/dashboard');

    // Absolute URLs with protocols
    expect(getSafeReturnTo('https://evil.example.com')).toBe('/dashboard');
    expect(getSafeReturnTo('http://evil.example.com/login')).toBe('/dashboard');
    expect(getSafeReturnTo('javascript:alert(document.cookie)')).toBe('/dashboard');

    // Protocol tricks before slash
    expect(getSafeReturnTo('/login:evil')).toBe('/dashboard');

    // Null/undefined/empty
    expect(getSafeReturnTo(null)).toBe('/dashboard');
    expect(getSafeReturnTo(undefined)).toBe('/dashboard');
    expect(getSafeReturnTo('')).toBe('/dashboard');
  });

  // =========================================================================
  // 6. XSS / UNTRUSTED HTML RENDERING AUDIT
  // =========================================================================

  it('6. AI assistant and citations render untrusted HTML as plain text without execution', () => {
    const maliciousPayload = '<img src="invalid" onerror="window.__hacked=true" /><script>window.__pwned=true</script><b>Bold Text</b>';

    render(
      <ChatMessageItem
        id="msg-malicious-1"
        role="assistant"
        content={maliciousPayload}
        createdAt="2026-09-25T10:00:00Z"
        sources={[
          {
            chunk_id: 'chunk-xss',
            document_title: '<script>evil()</script> Document',
            section_title: '<b>Section</b>',
            similarity_score: 0.95,
          },
        ]}
      />,
    );

    // Verified: text content matches literally without HTML parsing
    expect(screen.getByText(new RegExp(maliciousPayload, 'i'))).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect((window as unknown as { __hacked?: boolean }).__hacked).toBeUndefined();
  });

  // =========================================================================
  // 7. MODAL ACCESSIBILITY AUDIT
  // =========================================================================

  it('7. modals implement accessible dialog role, aria-labelledby, and accessible dismiss buttons', async () => {
    const onConfirmMock = vi.fn();
    const onCancelMock = vi.fn();

    render(
      <DeleteConversationModal
        isOpen={true}
        conversationTitle="Hypertrophy Training Routine"
        isDeleting={false}
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: /delete conversation/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    const deleteBtn = screen.getByRole('button', { name: /delete conversation/i });

    expect(cancelBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    await userEvent.click(cancelBtn);
    expect(onCancelMock).toHaveBeenCalledTimes(1);

    await userEvent.click(deleteBtn);
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  // =========================================================================
  // 8. FORM ACCESSIBILITY & PASSWORD STRENGTH AUDIT
  // =========================================================================

  it('8. password validation utility enforces strong password rules matching backend', () => {
    // Too short (< 8)
    expect(validatePasswordStrength('Short1!')).toBe('Password must be at least 8 characters');
    // Missing uppercase
    expect(validatePasswordStrength('lowercase1!')).toBe('Password must contain an uppercase letter');
    // Missing digit
    expect(validatePasswordStrength('NoDigitsHere!')).toBe('Password must contain a digit');
    // Missing special char
    expect(validatePasswordStrength('NoSpecialChar123')).toBe('Password must contain a special character (!@#$%^&*(),.?":{}|<>)');
    // Valid password
    expect(validatePasswordStrength('ValidP@ssword123')).toBeNull();
  });

  // =========================================================================
  // 9. CONDITIONAL UI & RESPONSIVE TOGGLE AUDIT
  // =========================================================================

  it('9. mobile navigation toggle controls aria-expanded state and drawer visibility', async () => {
    localStorage.setItem('fitness_access_token', 'valid-test-token');
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>,
    );

    const mobileToggle = await screen.findByRole('button', { name: /open navigation menu/i });
    expect(mobileToggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(mobileToggle);
    const activeToggle = screen.getByRole('button', { name: /close navigation menu/i });
    expect(activeToggle).toHaveAttribute('aria-expanded', 'true');
  });

  // =========================================================================
  // 10. CANONICAL WORKOUT TYPE INVARIANT AUDIT
  // =========================================================================

  it('10. canonical recommendation workout types match exact 7-element set and strictly omit legs, hiit, and recovery', () => {
    const expectedCanonicalSet = [
      'cardio',
      'full_body',
      'lower_body',
      'mobility',
      'pull',
      'push',
      'upper_body',
    ];

    // Verify exact set equality (sorted)
    expect([...VALID_WORKOUT_TYPES].sort()).toEqual(expectedCanonicalSet.sort());
    expect(VALID_WORKOUT_TYPES).toHaveLength(7);

    // Verify presence of all 7 canonical types
    expect(VALID_WORKOUT_TYPES).toContain('full_body');
    expect(VALID_WORKOUT_TYPES).toContain('upper_body');
    expect(VALID_WORKOUT_TYPES).toContain('lower_body');
    expect(VALID_WORKOUT_TYPES).toContain('push');
    expect(VALID_WORKOUT_TYPES).toContain('pull');
    expect(VALID_WORKOUT_TYPES).toContain('cardio');
    expect(VALID_WORKOUT_TYPES).toContain('mobility');

    // Strict invariant: legs, hiit, and recovery must be strictly absent
    expect(VALID_WORKOUT_TYPES).not.toContain('legs');
    expect(VALID_WORKOUT_TYPES).not.toContain('hiit');
    expect(VALID_WORKOUT_TYPES).not.toContain('recovery');
  });

  // =========================================================================
  // 11. CODE-SPLITTING & LAZY ROUTING UNDER SUSPENSE
  // =========================================================================

  it('11. lazy-loaded route renders correctly under Suspense fallback', async () => {
    localStorage.setItem('fitness_access_token', 'valid-test-token');
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/users/me') || url.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify(mockUser), { status: 200 });
      }
      if (url.includes('/api/v1/profile')) {
        return new Response(
          JSON.stringify({
            first_name: 'Hardened',
            last_name: 'Tester',
            date_of_birth: '1995-01-01',
            gender: 'prefer_not_to_say',
            height_cm: 180,
            current_weight_kg: 80,
            activity_level: 'moderately_active',
          }),
          { status: 200 },
        );
      }
      if (url.includes('/api/v1/goals')) {
        return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      }
      if (url.includes('/api/v1/preferences')) {
        return new Response(
          JSON.stringify({ dietary_preference: 'none', allergy_ids: [], disliked_food_ids: [] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Suspense resolves dynamically imported ProfilePage
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /profile & preferences/i })).toBeInTheDocument();
    });
  });
});
