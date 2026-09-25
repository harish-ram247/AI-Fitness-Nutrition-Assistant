import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { WorkoutSetRead } from '../../../types/workout';
import { getErrorMessage } from '../../../utils/errorHandling';

interface DeleteWorkoutSetModalProps {
  workoutId: string;
  exerciseEntryId: string;
  set: WorkoutSetRead | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workoutId: string) => void;
}

export const DeleteWorkoutSetModal: React.FC<DeleteWorkoutSetModalProps> = ({
  workoutId,
  exerciseEntryId,
  set,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !set) return null;

  const handleDelete = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await workoutApi.deleteWorkoutSet(workoutId, exerciseEntryId, set.id);
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
      aria-labelledby="delete-workout-set-title"
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
          maxWidth: '440px',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h2
          id="delete-workout-set-title"
          style={{ margin: 0, fontSize: '1.25rem', color: '#b91c1c', marginBottom: '0.75rem' }}
        >
          Delete Workout Set
        </h2>

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

        <p style={{ margin: 0, marginBottom: '1.25rem', fontSize: '0.875rem', color: '#475569' }}>
          Are you sure you want to delete <strong>Set #{set.set_number}</strong>?
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
