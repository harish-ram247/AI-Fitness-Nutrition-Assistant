import React, { useState, useEffect } from 'react';
import { profileApi } from '../profileApi';
import { ApiError } from '../../../api/errors';
import { GOAL_TYPE_PRESETS, type FitnessGoalCreate, type FitnessGoalRead, type FitnessGoalUpdate } from '../../../types/goal';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalToEdit: FitnessGoalRead | null;
  onGoalSaved: (savedGoal: FitnessGoalRead) => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  goalToEdit,
  onGoalSaved,
}) => {
  const isEditMode = Boolean(goalToEdit);

  const [goalType, setGoalType] = useState<string>('weight_loss');
  const [customGoalType, setCustomGoalType] = useState<string>('');
  const [targetValue, setTargetValue] = useState<string>('');
  const [targetUnit, setTargetUnit] = useState<string>('kg');
  const [targetDate, setTargetDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [status, setStatus] = useState<string>('active');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (goalToEdit) {
      const preset = GOAL_TYPE_PRESETS.find((p) => p.value === goalToEdit.goal_type);
      if (preset) {
        setGoalType(preset.value);
        setCustomGoalType('');
      } else {
        setGoalType('custom');
        setCustomGoalType(goalToEdit.goal_type);
      }
      setTargetValue(goalToEdit.target_value != null ? String(goalToEdit.target_value) : '');
      setTargetUnit(goalToEdit.target_unit || '');
      setTargetDate(goalToEdit.target_date || '');
      setDescription(goalToEdit.description || '');
      setStatus(goalToEdit.status || 'active');
    } else {
      setGoalType('weight_loss');
      setCustomGoalType('');
      setTargetValue('');
      setTargetUnit('kg');
      setTargetDate('');
      setDescription('');
      setStatus('active');
    }
    setError(null);
    setFieldErrors({});
  }, [goalToEdit, isOpen]);

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

  if (!isOpen) {
    return null;
  }

  const handleGoalTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setGoalType(val);
    const preset = GOAL_TYPE_PRESETS.find((p) => p.value === val);
    if (preset) {
      setTargetUnit(preset.defaultUnit);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setFieldErrors({});

    const effectiveGoalType = goalType === 'custom' ? customGoalType.trim() : goalType;
    if (!effectiveGoalType) {
      setFieldErrors({ goal_type: 'Goal type is required.' });
      return;
    }

    if (targetValue.trim()) {
      const val = parseFloat(targetValue);
      if (isNaN(val) || val <= 0) {
        setFieldErrors({ target_value: 'Target value must be a positive number.' });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && goalToEdit) {
        const updatePayload: FitnessGoalUpdate = {
          goal_type: effectiveGoalType,
          description: description.trim() || null,
          target_value: targetValue.trim() ? parseFloat(targetValue) : null,
          target_unit: targetUnit.trim() || null,
          target_date: targetDate || null,
          status,
        };
        const updated = await profileApi.updateGoal(goalToEdit.id, updatePayload);
        onGoalSaved(updated);
      } else {
        const createPayload: FitnessGoalCreate = {
          goal_type: effectiveGoalType,
          description: description.trim() || null,
          target_value: targetValue.trim() ? parseFloat(targetValue) : null,
          target_unit: targetUnit.trim() || null,
          target_date: targetDate || null,
        };
        const created = await profileApi.createGoal(createPayload);
        onGoalSaved(created);
      }
      onClose();
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
        setError('Failed to save goal. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
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
          maxWidth: '520px',
          padding: 'var(--spacing-6)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-4)' }}>
          <h2 id="goal-modal-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {isEditMode ? 'Edit Fitness Goal' : 'Create New Fitness Goal'}
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
          {/* Goal Type */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="goal_type_select"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Goal Category <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <select
              id="goal_type_select"
              value={goalType}
              onChange={handleGoalTypeChange}
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
              {GOAL_TYPE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom Goal Type...</option>
            </select>
          </div>

          {/* Custom Goal Type Input if selected */}
          {goalType === 'custom' && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <label
                htmlFor="custom_goal_type"
                style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Custom Goal Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                id="custom_goal_type"
                type="text"
                placeholder="e.g. Marathon training"
                value={customGoalType}
                onChange={(e) => setCustomGoalType(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.goal_type)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.goal_type ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.goal_type && (
                <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', display: 'block', marginTop: 'var(--spacing-1)' }}>
                  {fieldErrors.goal_type}
                </span>
              )}
            </div>
          )}

          {/* Target Value and Unit Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-4)' }}>
            <div>
              <label
                htmlFor="target_value"
                style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Target Value
              </label>
              <input
                id="target_value"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 75"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.target_value)}
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-primary)',
                  border: `1px solid ${fieldErrors.target_value ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  boxSizing: 'border-box',
                }}
              />
              {fieldErrors.target_value && (
                <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', display: 'block', marginTop: 'var(--spacing-1)' }}>
                  {fieldErrors.target_value}
                </span>
              )}
            </div>

            <div>
              <label
                htmlFor="target_unit"
                style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Unit
              </label>
              <input
                id="target_unit"
                type="text"
                placeholder="e.g. kg"
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
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
          </div>

          {/* Target Date */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="target_date"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Target Date (Optional)
            </label>
            <input
              id="target_date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
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

          {/* Description */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              htmlFor="description"
              style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
            >
              Description &amp; Notes
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="e.g. Reduce body fat while maintaining lean muscle mass..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                resize: 'vertical',
              }}
            />
          </div>

          {/* Status (Edit Mode Only) */}
          {isEditMode && (
            <div style={{ marginBottom: 'var(--spacing-5)' }}>
              <label
                htmlFor="goal_status"
                style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
              >
                Goal Status
              </label>
              <select
                id="goal_status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
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
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
          )}

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
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Goal' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
