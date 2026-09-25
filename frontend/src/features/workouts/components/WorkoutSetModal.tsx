import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { WorkoutSetCreate, WorkoutSetRead, WorkoutSetUpdate } from '../../../types/workout';
import { VALID_SET_TYPES, SET_TYPE_LABELS } from '../../../types/workout';
import { getErrorMessage } from '../../../utils/errorHandling';

interface WorkoutSetModalProps {
  workoutId: string;
  exerciseEntryId: string;
  existingSet?: WorkoutSetRead | null;
  suggestedSetNumber?: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (workoutId: string) => void;
}

export const WorkoutSetModal: React.FC<WorkoutSetModalProps> = ({
  workoutId,
  exerciseEntryId,
  existingSet,
  suggestedSetNumber = 1,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(existingSet);

  const [setNumber, setSetNumber] = useState<number>(() =>
    isEditing ? existingSet!.set_number : suggestedSetNumber,
  );
  const [setType, setSetType] = useState<string>(() =>
    isEditing ? existingSet!.set_type : 'working',
  );
  const [weightKg, setWeightKg] = useState<string>(() =>
    isEditing && existingSet!.weight_kg !== null && existingSet!.weight_kg !== undefined
      ? String(existingSet!.weight_kg)
      : '',
  );
  const [reps, setReps] = useState<string>(() =>
    isEditing && existingSet!.reps !== null && existingSet!.reps !== undefined
      ? String(existingSet!.reps)
      : '',
  );
  const [durationSeconds, setDurationSeconds] = useState<string>(() =>
    isEditing && existingSet!.duration_seconds !== null && existingSet!.duration_seconds !== undefined
      ? String(existingSet!.duration_seconds)
      : '',
  );
  const [distanceM, setDistanceM] = useState<string>(() =>
    isEditing && existingSet!.distance_m !== null && existingSet!.distance_m !== undefined
      ? String(existingSet!.distance_m)
      : '',
  );
  const [rpe, setRpe] = useState<string>(() =>
    isEditing && existingSet!.rpe !== null && existingSet!.rpe !== undefined
      ? String(existingSet!.rpe)
      : '',
  );
  const [completed, setCompleted] = useState<boolean>(() =>
    isEditing ? existingSet!.completed : true,
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (setNumber < 1) {
      setErrorMessage('Set number must be at least 1.');
      return;
    }

    // Parse and validate numeric fields
    let parsedWeight: number | null = null;
    if (weightKg.trim()) {
      parsedWeight = parseFloat(weightKg);
      if (isNaN(parsedWeight) || parsedWeight < 0) {
        setErrorMessage('Weight cannot be negative.');
        return;
      }
    }

    let parsedReps: number | null = null;
    if (reps.trim()) {
      parsedReps = parseInt(reps, 10);
      if (isNaN(parsedReps) || parsedReps < 0) {
        setErrorMessage('Reps cannot be negative.');
        return;
      }
    }

    let parsedDuration: number | null = null;
    if (durationSeconds.trim()) {
      parsedDuration = parseInt(durationSeconds, 10);
      if (isNaN(parsedDuration) || parsedDuration < 0) {
        setErrorMessage('Duration cannot be negative.');
        return;
      }
    }

    let parsedDistance: number | null = null;
    if (distanceM.trim()) {
      parsedDistance = parseFloat(distanceM);
      if (isNaN(parsedDistance) || parsedDistance < 0) {
        setErrorMessage('Distance cannot be negative.');
        return;
      }
    }

    let parsedRpe: number | null = null;
    if (rpe.trim()) {
      parsedRpe = parseFloat(rpe);
      if (isNaN(parsedRpe) || parsedRpe < 1.0 || parsedRpe > 10.0) {
        setErrorMessage('RPE must be between 1.0 and 10.0.');
        return;
      }
      if ((parsedRpe * 2) % 1 !== 0) {
        setErrorMessage('RPE must be in 0.5 increments (e.g. 7.0, 7.5, 8.0).');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isEditing && existingSet) {
        const payload: WorkoutSetUpdate = {
          set_number: setNumber,
          set_type: setType,
          weight_kg: parsedWeight,
          reps: parsedReps,
          duration_seconds: parsedDuration,
          distance_m: parsedDistance,
          rpe: parsedRpe,
          completed,
        };
        await workoutApi.updateWorkoutSet(workoutId, exerciseEntryId, existingSet.id, payload);
      } else {
        const payload: WorkoutSetCreate = {
          set_number: setNumber,
          set_type: setType,
          weight_kg: parsedWeight,
          reps: parsedReps,
          duration_seconds: parsedDuration,
          distance_m: parsedDistance,
          rpe: parsedRpe,
          completed,
        };
        await workoutApi.addWorkoutSet(workoutId, exerciseEntryId, payload);
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
      aria-labelledby="workout-set-modal-title"
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
          maxWidth: '480px',
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
          <h2 id="workout-set-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            {isEditing ? `Edit Set #${existingSet?.set_number}` : 'Add New Set'}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="set-number-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Set Number *
              </label>
              <input
                id="set-number-input"
                type="number"
                min="1"
                required
                className="form-input"
                value={setNumber}
                onChange={(e) => setSetNumber(parseInt(e.target.value, 10) || 1)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="set-type-select"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Set Type
              </label>
              <select
                id="set-type-select"
                className="form-input"
                value={setType}
                onChange={(e) => setSetType(e.target.value)}
                style={{ width: '100%' }}
              >
                {VALID_SET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SET_TYPE_LABELS[type] || type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="set-weight-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Weight (kg)
              </label>
              <input
                id="set-weight-input"
                type="number"
                step="0.5"
                min="0"
                placeholder="Optional"
                className="form-input"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="set-reps-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Reps
              </label>
              <input
                id="set-reps-input"
                type="number"
                min="0"
                placeholder="Optional"
                className="form-input"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="set-duration-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Duration (seconds)
              </label>
              <input
                id="set-duration-input"
                type="number"
                min="0"
                placeholder="Optional"
                className="form-input"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="set-distance-input"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Distance (meters)
              </label>
              <input
                id="set-distance-input"
                type="number"
                step="0.1"
                min="0"
                placeholder="Optional"
                className="form-input"
                value={distanceM}
                onChange={(e) => setDistanceM(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="set-rpe-input"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              RPE (1.0 – 10.0, step 0.5)
            </label>
            <input
              id="set-rpe-input"
              type="number"
              step="0.5"
              min="1"
              max="10"
              placeholder="e.g. 7.5 or 8.0"
              className="form-input"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              id="set-completed-check"
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
            />
            <label
              htmlFor="set-completed-check"
              style={{ fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              Completed successfully
            </label>
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
              {isLoading ? 'Saving...' : isEditing ? 'Update Set' : 'Add Set'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
