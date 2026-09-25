import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSafeReturnTo } from '../utils/security';

export interface PublicRouteProps {
  children?: React.ReactNode;
}

/**
 * PublicRoute: Wraps authentication-only routes (e.g., /login, /register).
 *
 * Lifecycle:
 * - isLoading: displays accessible loading indicator.
 * - isAuthenticated: redirects to safe intended destination or /dashboard.
 * - !isAuthenticated: renders public content.
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Checking session"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-base)',
        }}
      >
        <span>Loading session...</span>
      </div>
    );
  }

  if (isAuthenticated) {
    const rawReturnTo = searchParams.get('returnTo');
    const destination = getSafeReturnTo(rawReturnTo, '/dashboard');
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};
