import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../api/errors';
import { getSafeReturnTo } from '../../../utils/security';

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawReturnTo = searchParams.get('returnTo');
  const safeReturnTo = getSafeReturnTo(rawReturnTo, '/dashboard');
  const isRegisteredSuccess = searchParams.get('registered') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Email is required');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      navigate(safeReturnTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Invalid email or password. Please try again.');
        } else {
          setErrorMessage(err.message || 'An error occurred during sign in.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Sign in form">
      {isRegisteredSuccess && (
        <div
          role="status"
          style={{
            padding: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-success-bg)',
            color: 'var(--color-success)',
            border: '1px solid var(--color-success)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Registration successful! Please sign in with your credentials.
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: 'var(--spacing-3)',
            marginBottom: 'var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {errorMessage}
        </div>
      )}

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label
          htmlFor="login-email"
          style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isSubmitting}
        />
      </div>

      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <label
          htmlFor="login-password"
          style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          disabled={isSubmitting}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{ width: '100%', marginBottom: 'var(--spacing-4)' }}
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Don&apos;t have an account? </span>
        <Link to={rawReturnTo ? `/register?returnTo=${encodeURIComponent(rawReturnTo)}` : '/register'}>
          Register here
        </Link>
      </div>
    </form>
  );
};
