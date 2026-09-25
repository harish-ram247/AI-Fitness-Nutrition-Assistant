import React from 'react';
import { Link } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';
import { RegisterForm } from '../features/auth/components/RegisterForm';

export const LoginPage: React.FC = () => (
  <div>
    <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-4)' }}>Sign In</h2>
    <LoginForm />
  </div>
);

export const RegisterPage: React.FC = () => (
  <div>
    <h2 style={{ textAlign: 'center', marginBottom: 'var(--spacing-4)' }}>Create Account</h2>
    <RegisterForm />
  </div>
);





export const NotFoundPage: React.FC = () => (
  <div style={{ textAlign: 'center', padding: 'var(--spacing-12)' }}>
    <h1 style={{ fontSize: 'var(--font-size-3xl)', color: 'var(--color-primary)' }}>404</h1>
    <h2>Page Not Found</h2>
    <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--spacing-4)' }}>
      The requested route does not exist.
    </p>
    <Link to="/dashboard">Return to Dashboard</Link>
  </div>
);
