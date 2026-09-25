import React, { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../profileApi';
import { ApiError } from '../../../api/errors';
import { ACTIVITY_LEVEL_OPTIONS, SEX_OPTIONS, type UserProfileRead } from '../../../types/profile';

interface ProfileFormState {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  height_cm: string;
  activity_level: string;
}

export const ProfileForm: React.FC = () => {
  const [profile, setProfile] = useState<UserProfileRead | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    sex: '',
    height_cm: '',
    activity_level: 'sedentary',
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        date_of_birth: data.date_of_birth || '',
        sex: data.sex || '',
        height_cm: data.height_cm != null ? String(data.height_cm) : '',
        activity_level: data.activity_level || 'sedentary',
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load profile. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSuccessMessage(null);
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!form.first_name.trim()) {
      errors.first_name = 'First name is required.';
    }

    if (form.height_cm.trim()) {
      const height = parseFloat(form.height_cm);
      if (isNaN(height) || height < 50 || height > 300) {
        errors.height_cm = 'Height must be between 50 and 300 cm.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        height_cm: form.height_cm.trim() ? parseFloat(form.height_cm) : null,
        activity_level: form.activity_level || 'sedentary',
      };

      const updated = await profileApi.updateProfile(payload);
      setProfile(updated);
      setForm({
        first_name: updated.first_name || '',
        last_name: updated.last_name || '',
        date_of_birth: updated.date_of_birth || '',
        sex: updated.sex || '',
        height_cm: updated.height_cm != null ? String(updated.height_cm) : '',
        activity_level: updated.activity_level || 'sedentary',
      });
      setSuccessMessage('Profile updated successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.validationErrors && err.validationErrors.length > 0) {
          const serverFieldErrors: Record<string, string> = {};
          err.validationErrors.forEach((ve) => {
            const fieldName = String(ve.loc[ve.loc.length - 1]);
            serverFieldErrors[fieldName] = ve.msg;
          });
          setFieldErrors(serverFieldErrors);
        }
      } else {
        setError('Failed to save profile. Please check your connection and try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="profile-loading"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-4)',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
          Loading profile details...
        </span>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div
        role="alert"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--color-error)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-6)',
          textAlign: 'center',
        }}
      >
        <p style={{ color: 'var(--color-error)', margin: '0 0 var(--spacing-4) 0' }}>{error}</p>
        <button
          type="button"
          onClick={loadProfile}
          style={{
            backgroundColor: 'var(--bg-surface-hover)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: 'var(--spacing-2) var(--spacing-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
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
      <div style={{ marginBottom: 'var(--spacing-6)' }}>
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Personal Information
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>
          Update your biographical details and baseline physical attributes.
        </p>
      </div>

      {successMessage && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            marginBottom: 'var(--spacing-5)',
            color: 'var(--color-success)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            marginBottom: 'var(--spacing-5)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-5)',
          }}
        >
          {/* First Name */}
          <div>
            <label
              htmlFor="first_name"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              First Name <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              value={form.first_name}
              onChange={handleChange}
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.first_name)}
              aria-describedby={fieldErrors.first_name ? 'first_name-error' : undefined}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${fieldErrors.first_name ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.first_name && (
              <span id="first_name-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                {fieldErrors.first_name}
              </span>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label
              htmlFor="last_name"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Last Name
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              value={form.last_name}
              onChange={handleChange}
              disabled={isSaving}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label
              htmlFor="date_of_birth"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Date of Birth
            </label>
            <input
              id="date_of_birth"
              name="date_of_birth"
              type="date"
              value={form.date_of_birth}
              onChange={handleChange}
              disabled={isSaving}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Biological Sex */}
          <div>
            <label
              htmlFor="sex"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Biological Sex
            </label>
            <select
              id="sex"
              name="sex"
              value={form.sex}
              onChange={handleChange}
              disabled={isSaving}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Not Specified</option>
              {SEX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Height (cm) */}
          <div>
            <label
              htmlFor="height_cm"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Height (cm)
            </label>
            <input
              id="height_cm"
              name="height_cm"
              type="number"
              step="0.1"
              min="50"
              max="300"
              placeholder="e.g. 175.5"
              value={form.height_cm}
              onChange={handleChange}
              disabled={isSaving}
              aria-invalid={Boolean(fieldErrors.height_cm)}
              aria-describedby={fieldErrors.height_cm ? 'height_cm-error' : undefined}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${fieldErrors.height_cm ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.height_cm && (
              <span id="height_cm-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                {fieldErrors.height_cm}
              </span>
            )}
          </div>

          {/* Activity Level */}
          <div>
            <label
              htmlFor="activity_level"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Activity Level
            </label>
            <select
              id="activity_level"
              name="activity_level"
              value={form.activity_level}
              onChange={handleChange}
              disabled={isSaving}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            >
              {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Weight Read-Only Cache Info (ADR-014) */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            marginBottom: 'var(--spacing-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--spacing-2)',
          }}
        >
          <div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
              Current Weight (Derived from Progress Log)
            </span>
            <span
              data-testid="profile-current-weight"
              style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)' }}
            >
              {profile?.current_weight_kg != null ? `${Number(profile.current_weight_kg).toFixed(1)} kg` : 'No weight logged yet'}
            </span>
          </div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
            ℹ️ Log new weigh-ins via the Progress tracker to update weight records.
          </span>
        </div>

        {/* Form Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
          <button
            type="submit"
            disabled={isSaving}
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#ffffff',
              border: 'none',
              padding: 'var(--spacing-2) var(--spacing-6)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              transition: 'opacity var(--transition-fast)',
            }}
          >
            {isSaving ? 'Saving Profile...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};
