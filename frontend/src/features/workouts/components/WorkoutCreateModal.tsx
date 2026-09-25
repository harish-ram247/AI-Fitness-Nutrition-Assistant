import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { WorkoutSessionCreate, WorkoutSessionRead } from '../../../types/workout';
import { getErrorMessage } from '../../../utils/errorHandling';

interface WorkoutCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workout: WorkoutSessionRead) => void;
}

export const WorkoutCreateModal: React.FC<WorkoutCreateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Format current local time as YYYY-MM-DDTHH:mm for datetime-local input
  const toLocalInputValue = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const [name, setName] = useState('');
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(new Date()));
  const [isInProgress, setIsInProgress] = useState(true);
  const [endedAt, setEndedAt] = useState(() => toLocalInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!startedAt) {
      setErrorMessage('Start time is required.');
      return;
    }

    const startDate = new Date(startedAt);
    if (isNaN(startDate.getTime())) {
      setErrorMessage('Invalid start time.');
      return;
    }

    let endDateIso: string | null = null;
    if (!isInProgress) {
      if (!endedAt) {
        setErrorMessage('End time is required when workout is marked as completed.');
        return;
      }
      const endDate = new Date(endedAt);
      if (isNaN(endDate.getTime())) {
        setErrorMessage('Invalid end time.');
        return;
      }
      if (endDate < startDate) {
        setErrorMessage('End time cannot be earlier than start time.');
        return;
      }
      endDateIso = endDate.toISOString();
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const payload: WorkoutSessionCreate = {
      name: name.trim() || null,
      started_at: startDate.toISOString(), // Timezone-aware ISO string
      ended_at: endDateIso,
      notes: notes.trim() || null,
      tags,
    };

    setIsLoading(true);
    try {
      const created = await workoutApi.createWorkout(payload);
      onSuccess(created);
      onClose();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-workout-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2 id="create-workout-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Start / Log Workout
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
            }}
          >
            &times;
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              htmlFor="workout-name-input"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Workout Name (Optional)
            </label>
            <input
              id="workout-name-input"
              type="text"
              className="form-input"
              placeholder="e.g. Upper Body Strength, Leg Day"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="workout-started-at-input"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Start Time *
            </label>
            <input
              id="workout-started-at-input"
              type="datetime-local"
              className="form-input"
              required
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="workout-in-progress-check"
              type="checkbox"
              checked={isInProgress}
              onChange={(e) => setIsInProgress(e.target.checked)}
              style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
            />
            <label
              htmlFor="workout-in-progress-check"
              style={{ fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Workout is currently in progress / active
            </label>
          </div>

          {!isInProgress && (
            <div>
              <label
                htmlFor="workout-ended-at-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                End Time *
              </label>
              <input
                id="workout-ended-at-input"
                type="datetime-local"
                className="form-input"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div>
            <label
              htmlFor="workout-tags-input"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Tags (comma separated)
            </label>
            <input
              id="workout-tags-input"
              type="text"
              className="form-input"
              placeholder="e.g. chest, hypertrophy, morning"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="workout-notes-input"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Notes (Optional)
            </label>
            <textarea
              id="workout-notes-input"
              className="form-input"
              rows={3}
              placeholder="Felt strong on bench press, good energy levels..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
