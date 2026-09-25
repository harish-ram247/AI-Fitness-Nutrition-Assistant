import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
}

/**
 * ProtectedRoute: Enforces real authenticated state for private routes.
 *
 * Lifecycle:
 * - isLoading: displays accessible loading spinner/status.
 * - !isAuthenticated: redirects to /login preserving intended destination via safe returnTo query param.
 * - isAuthenticated: renders protected content.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

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

  if (!isAuthenticated) {
    // Preserve current path & search as returnTo parameter
    const currentPath = location.pathname + location.search;
    const returnTo = encodeURIComponent(currentPath);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
};
