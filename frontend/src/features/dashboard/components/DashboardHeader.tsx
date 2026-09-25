import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { formatDate, getTodayDateString } from '../../../utils/date';

export const DashboardHeader: React.FC = () => {
  const { user } = useAuth();
  const today = formatDate(getTodayDateString());

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 'var(--spacing-3)',
        marginBottom: 'var(--spacing-6)',
      }}
    >
      <div>
        <h1 style={{ marginBottom: 'var(--spacing-1)' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          {user ? `Welcome back, ${user.email}!` : 'Welcome back!'} Here is your daily overview.
        </p>
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-2)',
          padding: 'var(--spacing-2) var(--spacing-3)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <span aria-hidden="true">📅</span>
        <time dateTime={getTodayDateString()}>{today}</time>
      </div>
    </div>
  );
};
