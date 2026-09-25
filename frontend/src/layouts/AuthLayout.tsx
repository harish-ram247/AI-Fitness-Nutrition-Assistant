import React from 'react';
import { Outlet } from 'react-router-dom';

/**
 * AuthLayout: Minimal centered shell for unauthenticated public views (Login, Register).
 */
export const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-8)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', color: 'var(--color-primary)', marginBottom: 'var(--spacing-1)' }}>
            AI Fitness Assistant
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Phase 8A Public Shell
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
};
