import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { WorkoutSessionRead, WorkoutSessionUpdate } from '../../../types/workout';
import { getErrorMessage } from '../../../utils/errorHandling';

interface WorkoutEditModalProps {
  workout: WorkoutSessionRead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: WorkoutSessionRead) => void;
}

export const WorkoutEditModal: React.FC<WorkoutEditModalProps> = ({
  workout,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toLocalInputValue = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  const [name, setName] = useState(() => workout?.name || '');
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(workout?.started_at));
  const [isInProgress, setIsInProgress] = useState(() => !workout?.ended_at);
  const [endedAt, setEndedAt] = useState(() => toLocalInputValue(workout?.ended_at));
  const [notes, setNotes] = useState(() => workout?.notes || '');
  const [tagsInput, setTagsInput] = useState(() => workout?.tags?.join(', ') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !workout) return null;

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
      if (endedAt) {
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
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    const payload: WorkoutSessionUpdate = {
      name: name.trim() || null,
      started_at: startDate.toISOString(),
      ended_at: endDateIso,
      notes: notes.trim() || null,
      tags,
    };

    setIsLoading(true);
    try {
      const updated = await workoutApi.updateWorkout(workout.id, payload);
      onSuccess(updated);
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
      aria-labelledby="edit-workout-title"
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
          <h2 id="edit-workout-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Edit Workout Session
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
              htmlFor="edit-workout-name"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Workout Name
            </label>
            <input
              id="edit-workout-name"
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="edit-workout-started-at"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Start Time *
            </label>
            <input
              id="edit-workout-started-at"
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
              id="edit-workout-in-progress"
              type="checkbox"
              checked={isInProgress}
              onChange={(e) => setIsInProgress(e.target.checked)}
              style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
            />
            <label
              htmlFor="edit-workout-in-progress"
              style={{ fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Workout is currently in progress / active
            </label>
          </div>

          {!isInProgress && (
            <div>
              <label
                htmlFor="edit-workout-ended-at"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                End Time
              </label>
              <input
                id="edit-workout-ended-at"
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
              htmlFor="edit-workout-tags"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Tags (comma separated)
            </label>
            <input
              id="edit-workout-tags"
              type="text"
              className="form-input"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="edit-workout-notes"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Notes
            </label>
            <textarea
              id="edit-workout-notes"
              className="form-input"
              rows={3}
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
              {isLoading ? 'Updating...' : 'Update Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
