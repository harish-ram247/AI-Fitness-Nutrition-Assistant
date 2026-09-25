import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { formatDate } from '../../../utils/date';

export const AccountInfoCard: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-6)',
        marginBottom: 'var(--spacing-6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Account Identity
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>
            System credentials and account status
          </p>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: 'var(--spacing-1) var(--spacing-3)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            backgroundColor: user.is_verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            color: user.is_verified ? 'var(--color-success)' : 'var(--color-warning)',
            border: user.is_verified ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
          }}
        >
          {user.is_verified ? '✓ Verified Account' : '● Verification Pending'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-4)',
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Email Address
          </span>
          <span
            data-testid="account-email-value"
            style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)' }}
          >
            {user.email}
          </span>
        </div>

        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Account ID
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            {user.id}
          </span>
        </div>

        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Member Since
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
            {formatDate(user.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
};
