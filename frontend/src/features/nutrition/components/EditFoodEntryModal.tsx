import React, { useState, useEffect } from 'react';
import { nutritionApi } from '../nutritionApi';
import { ApiError } from '../../../api/errors';
import { MEAL_TYPE_LABELS, VALID_MEAL_TYPES, type FoodEntryRead, type FoodEntryUpdate } from '../../../types/nutrition';

interface EditFoodEntryModalProps {
  isOpen: boolean;
  entry: FoodEntryRead | null;
  onClose: () => void;
  onEntryUpdated: () => void;
}

export const EditFoodEntryModal: React.FC<EditFoodEntryModalProps> = ({
  isOpen,
  entry,
  onClose,
  onEntryUpdated,
}) => {
  const [quantityGrams, setQuantityGrams] = useState<string>('');
  const [mealType, setMealType] = useState<string>('breakfast');
  const [loggedAtTime, setLoggedAtTime] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry) {
      setQuantityGrams(String(entry.quantity_g || '100'));
      setMealType(entry.meal_type || 'breakfast');
      // Format datetime-local string
      try {
        const d = new Date(entry.logged_at);
        const pad = (n: number) => String(n).padStart(2, '0');
        const localIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setLoggedAtTime(localIso);
      } catch {
        setLoggedAtTime('');
      }
      setError(null);
      setFieldErrors({});
    }
  }, [entry, isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setFieldErrors({});

    const q = parseFloat(quantityGrams);
    if (isNaN(q) || q <= 0) {
      setFieldErrors({ quantity_g: 'Quantity must be strictly greater than 0.' });
      return;
    }

    const payload: FoodEntryUpdate = {
      quantity_g: q,
      meal_type: mealType,
    };

    if (loggedAtTime) {
      const parsedDate = new Date(loggedAtTime);
      payload.logged_at = parsedDate.toISOString();
    }

    setIsSubmitting(true);
    try {
      await nutritionApi.updateFoodEntry(entry.id, payload);
      onEntryUpdated();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.validationErrors && err.validationErrors.length > 0) {
          const serverErrors: Record<string, string> = {};
          err.validationErrors.forEach((ve) => {
            const field = String(ve.loc[ve.loc.length - 1]);
            serverErrors[field] = ve.msg;
          });
          setFieldErrors(serverErrors);
        }
      } else {
        setError('Failed to update food entry.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-entry-modal-title"
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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '460px',
          padding: 'var(--spacing-6)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
          <h2 id="edit-entry-modal-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Edit Food Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: 'var(--spacing-1)',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-3)',
              marginBottom: 'var(--spacing-4)',
              color: 'var(--color-error)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Read-only Food Snapshot Name */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--spacing-1)' }}>
              Food Item (Snapshot)
            </span>
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              {entry.food_name_snapshot}
            </div>
          </div>

          {/* Quantity in Grams */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="edit_quantity_g"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Quantity (grams) <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              id="edit_quantity_g"
              type="number"
              step="0.1"
              min="0.1"
              value={quantityGrams}
              onChange={(e) => setQuantityGrams(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.quantity_g)}
              style={{
                width: '100%',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-primary)',
                border: `1px solid ${fieldErrors.quantity_g ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                color: 'var(--text-primary)',
                fontSize: 'var(--font-size-sm)',
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.quantity_g && (
              <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                {fieldErrors.quantity_g}
              </span>
            )}
          </div>

          {/* Meal Type Selection */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="edit_meal_type"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Meal
            </label>
            <select
              id="edit_meal_type"
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              disabled={isSubmitting}
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
              {VALID_MEAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MEAL_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Logged At Timestamp */}
          <div style={{ marginBottom: 'var(--spacing-5)' }}>
            <label
              htmlFor="edit_logged_at"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Logged At
            </label>
            <input
              id="edit_logged_at"
              type="datetime-local"
              value={loggedAtTime}
              onChange={(e) => setLoggedAtTime(e.target.value)}
              disabled={isSubmitting}
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

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: 'var(--spacing-2) var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#ffffff',
                padding: 'var(--spacing-2) var(--spacing-5)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Saving...' : 'Update Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
