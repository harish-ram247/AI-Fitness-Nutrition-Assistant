import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { ApiError } from '../../../api/errors';
import { validatePasswordStrength } from '../../../utils/security';

export interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Current password is required');
      return;
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccessMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setErrorMessage('Incorrect current password.');
        } else if (err.status === 422) {
          setErrorMessage(err.message || 'Validation error. Please verify password requirements.');
        } else {
          setErrorMessage(err.message || 'Failed to update password.');
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-password-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-6)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
          <h2 id="change-password-title" style={{ fontSize: 'var(--font-size-xl)' }}>
            Change Password
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 'var(--font-size-xl)',
              padding: 'var(--spacing-1)',
              cursor: 'pointer',
            }}
          >
            &times;
          </button>
        </div>

        {successMessage && (
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
            {successMessage}
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

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="current-password"
              style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
            >
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="new-password"
              style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
            />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              Min. 8 chars, 1 uppercase, 1 digit, 1 special symbol.
            </span>
          </div>

          <div style={{ marginBottom: 'var(--spacing-6)' }}>
            <label
              htmlFor="confirm-new-password"
              style={{ display: 'block', marginBottom: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
            >
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-3)', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
