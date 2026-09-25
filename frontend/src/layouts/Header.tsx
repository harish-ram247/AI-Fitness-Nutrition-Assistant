import React from 'react';
import { useAuth } from '../context/AuthContext';

export interface HeaderProps {
  onToggleMobileNav: () => void;
  isMobileNavOpen: boolean;
  onOpenChangePassword: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileNav,
  isMobileNavOpen,
  onOpenChangePassword,
}) => {
  const { user, logout } = useAuth();

  return (
    <header
      role="banner"
      style={{
        height: '60px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--spacing-4)',
        gap: 'var(--spacing-3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label={isMobileNavOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          aria-expanded={isMobileNavOpen}
          className="mobile-nav-toggle"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            padding: 0,
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: '1.25rem',
          }}
        >
          {isMobileNavOpen ? '✕' : '☰'}
        </button>

        <span
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          AI Fitness Assistant
        </span>
      </div>

      {/* User Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
        {user && (
          <span
            data-testid="header-user-email"
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            <span data-testid="user-email-display">{user.email}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onOpenChangePassword}
          aria-label="Change Password"
          style={{
            backgroundColor: 'transparent',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-1) var(--spacing-3)',
          }}
        >
          Change Password
        </button>

        <button
          type="button"
          onClick={() => logout()}
          aria-label="Sign Out"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            borderColor: 'var(--color-error)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-xs)',
            padding: 'var(--spacing-1) var(--spacing-3)',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
};
