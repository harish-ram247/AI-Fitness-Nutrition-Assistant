import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../api/errors';
import { getSafeReturnTo, validatePasswordStrength } from '../../../utils/security';

export const RegisterForm: React.FC = () => {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const rawReturnTo = searchParams.get('returnTo');
  const safeReturnTo = getSafeReturnTo(rawReturnTo, '/dashboard');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setValidationErrors([]);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Email is required');
      return;
    }

    // Client-side email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    // Client-side password strength validation (matches backend)
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ email: trimmedEmail, password });

      // Automatically sign in upon successful registration
      try {
        await login({ email: trimmedEmail, password });
        navigate(safeReturnTo, { replace: true });
      } catch {
        // If auto-login fails, redirect to login page with notice
        navigate('/login?registered=true', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage('An account with this email address already exists.');
        } else if (err.status === 422) {
          if (err.validationErrors && err.validationErrors.length > 0) {
            setValidationErrors(err.validationErrors.map((v) => v.msg));
          } else {
            setErrorMessage(err.message || 'Validation failed. Please check the form.');
          }
        } else {
          setErrorMessage(err.message || 'Registration failed. Please try again.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
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

      {validationErrors.length > 0 && (
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
          <ul style={{ paddingLeft: 'var(--spacing-4)', margin: 0 }}>
            {validationErrors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label
          htmlFor="register-email"
          style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          Email address
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={isSubmitting}
        />
      </div>

      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <label
          htmlFor="register-password"
          style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          Password
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 chars, 1 uppercase, 1 digit, 1 special"
          disabled={isSubmitting}
        />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
          Must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special symbol.
        </span>
      </div>

      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <label
          htmlFor="register-confirm-password"
          style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
        >
          Confirm Password
        </label>
        <input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          disabled={isSubmitting}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{ width: '100%', marginBottom: 'var(--spacing-4)' }}
      >
        {isSubmitting ? 'Creating account...' : 'Create Account'}
      </button>

      <div style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
        <span style={{ color: 'var(--text-muted)' }}>Already have an account? </span>
        <Link to={rawReturnTo ? `/login?returnTo=${encodeURIComponent(rawReturnTo)}` : '/login'}>
          Sign In
        </Link>
      </div>
    </form>
  );
};
