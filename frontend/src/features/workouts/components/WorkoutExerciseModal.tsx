import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { ExerciseRead } from '../../../types/exercise';
import type {
  WorkoutExerciseCreate,
  WorkoutExerciseRead,
  WorkoutExerciseUpdate,
} from '../../../types/workout';
import { getErrorMessage } from '../../../utils/errorHandling';

interface WorkoutExerciseModalProps {
  workoutId: string;
  isOpen: boolean;
  onClose: () => void;
  // If adding, exercise is provided
  exerciseToAdd?: ExerciseRead | null;
  // If editing, existingEntry is provided
  existingEntry?: WorkoutExerciseRead | null;
  defaultOrderIndex?: number;
  onSuccess: (updatedWorkoutId: string) => void;
}

export const WorkoutExerciseModal: React.FC<WorkoutExerciseModalProps> = ({
  workoutId,
  isOpen,
  onClose,
  exerciseToAdd,
  existingEntry,
  defaultOrderIndex = 0,
  onSuccess,
}) => {
  const isEditing = Boolean(existingEntry);
  const [orderIndex, setOrderIndex] = useState(() =>
    isEditing ? existingEntry!.order_index : defaultOrderIndex,
  );
  const [notes, setNotes] = useState(() => (isEditing ? existingEntry!.notes || '' : ''));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const exerciseName = isEditing
    ? existingEntry?.exercise?.name || 'Workout Exercise'
    : exerciseToAdd?.name || 'Selected Exercise';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (orderIndex < 0) {
      setErrorMessage('Order index cannot be negative.');
      return;
    }

    setIsLoading(true);
    try {
      if (isEditing && existingEntry) {
        const payload: WorkoutExerciseUpdate = {
          order_index: orderIndex,
          notes: notes.trim() || null,
        };
        await workoutApi.updateWorkoutExercise(workoutId, existingEntry.id, payload);
      } else if (exerciseToAdd) {
        const payload: WorkoutExerciseCreate = {
          exercise_id: exerciseToAdd.id,
          order_index: orderIndex,
          notes: notes.trim() || null,
        };
        await workoutApi.addWorkoutExercise(workoutId, payload);
      }
      onSuccess(workoutId);
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
      aria-labelledby="workout-exercise-modal-title"
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
          maxWidth: '460px',
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
          <h2 id="workout-exercise-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            {isEditing ? `Edit: ${exerciseName}` : `Add: ${exerciseName}`}
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
              htmlFor="exercise-order-index"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Order Index
            </label>
            <input
              id="exercise-order-index"
              type="number"
              min="0"
              className="form-input"
              value={orderIndex}
              onChange={(e) => setOrderIndex(parseInt(e.target.value, 10) || 0)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="exercise-entry-notes"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Notes (Optional)
            </label>
            <textarea
              id="exercise-entry-notes"
              className="form-input"
              rows={3}
              placeholder="e.g. Focus on deep stretch, slow eccentrics..."
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
              {isLoading ? 'Saving...' : isEditing ? 'Update Exercise' : 'Add to Workout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
