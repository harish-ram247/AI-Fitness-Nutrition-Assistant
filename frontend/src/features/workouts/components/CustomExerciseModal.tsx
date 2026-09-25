import React, { useState } from 'react';
import { workoutApi } from '../workoutApi';
import type { ExerciseCreate, ExerciseRead, ExerciseUpdate } from '../../../types/exercise';
import { VALID_EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from '../../../types/exercise';
import { getErrorMessage } from '../../../utils/errorHandling';

interface CustomExerciseModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingExercise?: ExerciseRead | null;
  onSuccess: (exercise: ExerciseRead) => void;
}

export const CustomExerciseModal: React.FC<CustomExerciseModalProps> = ({
  isOpen,
  onClose,
  existingExercise,
  onSuccess,
}) => {
  const isEditing = Boolean(existingExercise);

  const [name, setName] = useState(() => existingExercise?.name || '');
  const [category, setCategory] = useState<string>(() => existingExercise?.category || 'strength');
  const [muscleGroupsInput, setMuscleGroupsInput] = useState(
    () => existingExercise?.muscle_groups?.join(', ') || '',
  );
  const [equipment, setEquipment] = useState(() => existingExercise?.equipment || '');
  const [description, setDescription] = useState(() => existingExercise?.description || '');
  const [instructions, setInstructions] = useState(() => existingExercise?.instructions || '');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Exercise name is required.');
      return;
    }
    if (trimmedName.length > 255) {
      setErrorMessage('Exercise name cannot exceed 255 characters.');
      return;
    }

    const muscleGroups = muscleGroupsInput
      .split(',')
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);

    setIsLoading(true);
    try {
      if (isEditing && existingExercise) {
        const payload: ExerciseUpdate = {
          name: trimmedName,
          category,
          muscle_groups: muscleGroups,
          equipment: equipment.trim() || null,
          description: description.trim() || null,
          instructions: instructions.trim() || null,
        };
        const updated = await workoutApi.updateExercise(existingExercise.id, payload);
        onSuccess(updated);
      } else {
        const payload: ExerciseCreate = {
          name: trimmedName,
          category,
          muscle_groups: muscleGroups,
          equipment: equipment.trim() || null,
          description: description.trim() || null,
          instructions: instructions.trim() || null,
        };
        const created = await workoutApi.createExercise(payload);
        onSuccess(created);
      }
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
      aria-labelledby="custom-exercise-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
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
          <h2 id="custom-exercise-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            {isEditing ? 'Edit Custom Exercise' : 'Create Custom Exercise'}
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
              htmlFor="custom-exercise-name"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Exercise Name *
            </label>
            <input
              id="custom-exercise-name"
              type="text"
              required
              className="form-input"
              placeholder="e.g. Bulgarian Split Squat with Dumbbells"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label
                htmlFor="custom-exercise-category"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Category *
              </label>
              <select
                id="custom-exercise-category"
                required
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                {VALID_EXERCISE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {EXERCISE_CATEGORY_LABELS[cat] || cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="custom-exercise-equipment"
                style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
              >
                Equipment (Optional)
              </label>
              <input
                id="custom-exercise-equipment"
                type="text"
                className="form-input"
                placeholder="e.g. Dumbbell, Barbell, None"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-exercise-muscles"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Muscle Groups (comma separated)
            </label>
            <input
              id="custom-exercise-muscles"
              type="text"
              className="form-input"
              placeholder="e.g. quads, glutes, hamstrings"
              value={muscleGroupsInput}
              onChange={(e) => setMuscleGroupsInput(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="custom-exercise-desc"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Description (Optional)
            </label>
            <textarea
              id="custom-exercise-desc"
              className="form-input"
              rows={2}
              placeholder="Short summary of the exercise..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div>
            <label
              htmlFor="custom-exercise-instructions"
              style={{ display: 'block', fontWeight: 500, marginBottom: '0.25rem', fontSize: '0.875rem' }}
            >
              Instructions (Optional)
            </label>
            <textarea
              id="custom-exercise-instructions"
              className="form-input"
              rows={3}
              placeholder="Step-by-step form cues..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
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
              {isLoading ? 'Saving...' : isEditing ? 'Update Exercise' : 'Create Exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
