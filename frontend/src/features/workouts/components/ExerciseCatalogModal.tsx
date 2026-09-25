import React, { useState, useEffect, useCallback } from 'react';
import { workoutApi } from '../workoutApi';
import type { ExerciseRead } from '../../../types/exercise';
import { VALID_EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from '../../../types/exercise';
import { getErrorMessage } from '../../../utils/errorHandling';

interface ExerciseCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseRead) => void;
  onCreateCustom?: () => void;
}

export const ExerciseCatalogModal: React.FC<ExerciseCatalogModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
}) => {
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const resp = await workoutApi.listExercises({
        q: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        muscle_group: selectedMuscle.trim() || undefined,
        page: 1,
        size: 50,
      });
      setExercises(resp.items);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedMuscle]);

  useEffect(() => {
    if (isOpen) {
      fetchExercises();
    }
  }, [isOpen, fetchExercises]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExercises();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-catalog-title"
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
          maxWidth: '650px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 id="exercise-catalog-title" style={{ margin: 0, fontSize: '1.25rem' }}>
            Select Exercise
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

        {/* Search & Filters */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}
          >
            <input
              type="text"
              className="form-input"
              aria-label="Search exercises"
              placeholder="Search exercise catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" disabled={isLoading}>
              Search
            </button>
          </form>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              aria-label="Filter by category"
              className="form-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ fontSize: '0.875rem', padding: '0.35rem 0.5rem' }}
            >
              <option value="">All Categories</option>
              {VALID_EXERCISE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {EXERCISE_CATEGORY_LABELS[cat] || cat}
                </option>
              ))}
            </select>

            <input
              type="text"
              aria-label="Filter by muscle group"
              className="form-input"
              placeholder="Muscle (e.g. chest)"
              value={selectedMuscle}
              onChange={(e) => setSelectedMuscle(e.target.value)}
              style={{ fontSize: '0.875rem', padding: '0.35rem 0.5rem', width: '130px' }}
            />

            {onCreateCustom && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onCreateCustom}
                style={{ marginLeft: 'auto', fontSize: '0.875rem', padding: '0.35rem 0.75rem' }}
              >
                + Custom Exercise
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              margin: '1rem 1.5rem 0',
              padding: '0.75rem',
              background: '#fef2f2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              fontSize: '0.875rem',
            }}
          >
            {errorMessage}
            <button
              type="button"
              onClick={fetchExercises}
              style={{
                marginLeft: '0.5rem',
                textDecoration: 'underline',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#b91c1c',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
              Loading exercises...
            </div>
          ) : exercises.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              <p style={{ margin: 0, fontWeight: 500 }}>No exercises found matching your search.</p>
              {onCreateCustom && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateCustom}
                  style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}
                >
                  Create Custom Exercise
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    background: 'var(--color-surface, #ffffff)',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.95rem' }}>{exercise.name}</strong>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 600,
                          background:
                            exercise.category === 'strength'
                              ? '#e0e7ff'
                              : exercise.category === 'cardio'
                              ? '#fef3c7'
                              : '#f1f5f9',
                          color:
                            exercise.category === 'strength'
                              ? '#3730a3'
                              : exercise.category === 'cardio'
                              ? '#92400e'
                              : '#334155',
                          textTransform: 'capitalize',
                        }}
                      >
                        {exercise.category}
                      </span>
                      {!exercise.is_verified && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: '#dcfce7',
                            color: '#166534',
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted, #64748b)',
                        marginTop: '0.2rem',
                      }}
                    >
                      {exercise.muscle_groups?.length > 0 && (
                        <span>Muscles: {exercise.muscle_groups.join(', ')}</span>
                      )}
                      {exercise.equipment && <span> · Equipment: {exercise.equipment}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      onSelect(exercise);
                      onClose();
                    }}
                    aria-label={`Select ${exercise.name}`}
                    style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
