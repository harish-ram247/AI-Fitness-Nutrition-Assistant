import React, { useEffect, useState, useCallback } from 'react';
import { profileApi } from '../profileApi';
import { ApiError } from '../../../api/errors';
import {
  AI_PERSONA_OPTIONS,
  COMMON_DIETARY_RESTRICTIONS,
  UNIT_SYSTEM_OPTIONS,
  type UserPreferenceRead,
  type UserPreferenceUpdate,
} from '../../../types/preferences';

interface PreferencesFormState {
  unit_system: string;
  ai_persona: string;
  calorie_target: string;
  protein_target_g: string;
  carbs_target_g: string;
  fat_target_g: string;
  dietary_restrictions: string[];
}

export const PreferencesForm: React.FC = () => {
  const [preferences, setPreferences] = useState<UserPreferenceRead | null>(null);
  const [form, setForm] = useState<PreferencesFormState>({
    unit_system: 'metric',
    ai_persona: 'balanced',
    calorie_target: '',
    protein_target_g: '',
    carbs_target_g: '',
    fat_target_g: '',
    dietary_restrictions: [],
  });

  const [newTagInput, setNewTagInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileApi.getPreferences();
      setPreferences(data);
      setForm({
        unit_system: data.unit_system || 'metric',
        ai_persona: data.ai_persona || 'balanced',
        calorie_target: data.calorie_target != null ? String(data.calorie_target) : '',
        protein_target_g: data.protein_target_g != null ? String(data.protein_target_g) : '',
        carbs_target_g: data.carbs_target_g != null ? String(data.carbs_target_g) : '',
        fat_target_g: data.fat_target_g != null ? String(data.fat_target_g) : '',
        dietary_restrictions: data.dietary_restrictions || [],
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load preferences. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

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

  const handleToggleRestriction = (tag: string) => {
    setForm((prev) => {
      const exists = prev.dietary_restrictions.includes(tag);
      const updated = exists
        ? prev.dietary_restrictions.filter((item) => item !== tag)
        : [...prev.dietary_restrictions, tag];
      return { ...prev, dietary_restrictions: updated };
    });
    setSuccessMessage(null);
  };

  const handleAddCustomTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const cleanTag = newTagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanTag) return;

    if (!form.dietary_restrictions.includes(cleanTag)) {
      setForm((prev) => ({
        ...prev,
        dietary_restrictions: [...prev.dietary_restrictions, cleanTag],
      }));
    }
    setNewTagInput('');
    setSuccessMessage(null);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      dietary_restrictions: prev.dietary_restrictions.filter((t) => t !== tagToRemove),
    }));
    setSuccessMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setError(null);
    setSuccessMessage(null);
    setFieldErrors({});

    // Client-side numeric target validation
    const errors: Record<string, string> = {};

    if (form.calorie_target.trim()) {
      const cal = parseInt(form.calorie_target, 10);
      if (isNaN(cal) || cal <= 0) {
        errors.calorie_target = 'Calorie target must be a positive integer.';
      }
    }

    if (form.protein_target_g.trim()) {
      const p = parseFloat(form.protein_target_g);
      if (isNaN(p) || p < 0) {
        errors.protein_target_g = 'Protein target must be non-negative.';
      }
    }

    if (form.carbs_target_g.trim()) {
      const c = parseFloat(form.carbs_target_g);
      if (isNaN(c) || c < 0) {
        errors.carbs_target_g = 'Carbohydrates target must be non-negative.';
      }
    }

    if (form.fat_target_g.trim()) {
      const f = parseFloat(form.fat_target_g);
      if (isNaN(f) || f < 0) {
        errors.fat_target_g = 'Fat target must be non-negative.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const payload: UserPreferenceUpdate = {
        unit_system: form.unit_system || null,
        ai_persona: form.ai_persona || null,
        calorie_target: form.calorie_target.trim() ? parseInt(form.calorie_target, 10) : null,
        protein_target_g: form.protein_target_g.trim() ? parseFloat(form.protein_target_g) : null,
        carbs_target_g: form.carbs_target_g.trim() ? parseFloat(form.carbs_target_g) : null,
        fat_target_g: form.fat_target_g.trim() ? parseFloat(form.fat_target_g) : null,
        dietary_restrictions: form.dietary_restrictions,
      };

      const updated = await profileApi.updatePreferences(payload);
      setPreferences(updated);
      setForm({
        unit_system: updated.unit_system || 'metric',
        ai_persona: updated.ai_persona || 'balanced',
        calorie_target: updated.calorie_target != null ? String(updated.calorie_target) : '',
        protein_target_g: updated.protein_target_g != null ? String(updated.protein_target_g) : '',
        carbs_target_g: updated.carbs_target_g != null ? String(updated.carbs_target_g) : '',
        fat_target_g: updated.fat_target_g != null ? String(updated.fat_target_g) : '',
        dietary_restrictions: updated.dietary_restrictions || [],
      });
      setSuccessMessage('Preferences updated successfully.');
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
        setError('Failed to update preferences. Please check your connection and try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        data-testid="preferences-loading"
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
          Loading user preferences...
        </span>
      </div>
    );
  }

  if (error && !preferences) {
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
          onClick={loadPreferences}
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
          Preferences &amp; Nutritional Targets
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>
          Configure measurement systems, daily macro budgets, dietary constraints, and AI assistant persona.
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
        {/* System Settings Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 'var(--spacing-4)',
            marginBottom: 'var(--spacing-6)',
          }}
        >
          {/* Unit System */}
          <div>
            <label
              htmlFor="unit_system"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Unit System
            </label>
            <select
              id="unit_system"
              name="unit_system"
              value={form.unit_system}
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
              {UNIT_SYSTEM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.description})
                </option>
              ))}
            </select>
          </div>

          {/* AI Persona */}
          <div>
            <label
              htmlFor="ai_persona"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              AI Assistant Persona
            </label>
            <select
              id="ai_persona"
              name="ai_persona"
              value={form.ai_persona}
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
              {AI_PERSONA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nutritional Targets Grid */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--spacing-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Daily Nutritional Targets (Optional)
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 'var(--spacing-4)',
            }}
          >
            {/* Calorie Target */}
            <div>
              <label
                htmlFor="calorie_target"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Calories (kcal)
              </label>
              <input
                id="calorie_target"
                name="calorie_target"
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 2200"
                value={form.calorie_target}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.calorie_target)}
                aria-describedby={fieldErrors.calorie_target ? 'calorie_target-error' : undefined}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.calorie_target ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.calorie_target && (
                <span id="calorie_target-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                  {fieldErrors.calorie_target}
                </span>
              )}
            </div>

            {/* Protein Target */}
            <div>
              <label
                htmlFor="protein_target_g"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Protein (g)
              </label>
              <input
                id="protein_target_g"
                name="protein_target_g"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 150"
                value={form.protein_target_g}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.protein_target_g)}
                aria-describedby={fieldErrors.protein_target_g ? 'protein_target_g-error' : undefined}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.protein_target_g ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.protein_target_g && (
                <span id="protein_target_g-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                  {fieldErrors.protein_target_g}
                </span>
              )}
            </div>

            {/* Carbs Target */}
            <div>
              <label
                htmlFor="carbs_target_g"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Carbs (g)
              </label>
              <input
                id="carbs_target_g"
                name="carbs_target_g"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 200"
                value={form.carbs_target_g}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.carbs_target_g)}
                aria-describedby={fieldErrors.carbs_target_g ? 'carbs_target_g-error' : undefined}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.carbs_target_g ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.carbs_target_g && (
                <span id="carbs_target_g-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                  {fieldErrors.carbs_target_g}
                </span>
              )}
            </div>

            {/* Fat Target */}
            <div>
              <label
                htmlFor="fat_target_g"
                style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Fat (g)
              </label>
              <input
                id="fat_target_g"
                name="fat_target_g"
                type="number"
                min="0"
                step="0.1"
                placeholder="e.g. 65"
                value={form.fat_target_g}
                onChange={handleChange}
                disabled={isSaving}
                aria-invalid={Boolean(fieldErrors.fat_target_g)}
                aria-describedby={fieldErrors.fat_target_g ? 'fat_target_g-error' : undefined}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.fat_target_g ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.fat_target_g && (
                <span id="fat_target_g-error" style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                  {fieldErrors.fat_target_g}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dietary Restrictions Tags */}
        <div style={{ marginBottom: 'var(--spacing-6)' }}>
          <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-2)', color: 'var(--text-primary)' }}>
            Dietary Restrictions &amp; Allergies
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)' }}>
            {COMMON_DIETARY_RESTRICTIONS.map((item) => {
              const isSelected = form.dietary_restrictions.includes(item.value);
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleToggleRestriction(item.value)}
                  disabled={isSaving}
                  aria-pressed={isSelected}
                  style={{
                    padding: 'var(--spacing-1) var(--spacing-3)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--bg-primary)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {isSelected ? `✓ ${item.label}` : `+ ${item.label}`}
                </button>
              );
            })}
          </div>

          {/* Custom tags input and active tags list */}
          <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginBottom: 'var(--spacing-2)' }}>
            <input
              type="text"
              placeholder="Add other restriction (e.g. shellfish_free)..."
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleAddCustomTag}
              disabled={isSaving}
              style={{
                flex: 1,
                maxWidth: '320px',
                padding: 'var(--spacing-1) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-xs)',
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomTag}
              disabled={isSaving || !newTagInput.trim()}
              style={{
                backgroundColor: 'var(--bg-surface-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                padding: 'var(--spacing-1) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>

          {form.dietary_restrictions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-1)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginRight: 'var(--spacing-1)' }}>
                Active:
              </span>
              {form.dietary_restrictions.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-1)',
                    backgroundColor: 'var(--bg-surface-hover)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: 'var(--text-primary)',
                  }}
                >
                  {tag.replace(/_/g, ' ')}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove restriction ${tag}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                      lineHeight: 1,
                      fontSize: '0.8rem',
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
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
            {isSaving ? 'Saving Preferences...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  );
};
