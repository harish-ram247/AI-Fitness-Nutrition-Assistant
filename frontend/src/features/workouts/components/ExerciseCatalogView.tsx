import React, { useState, useEffect, useCallback } from 'react';
import { workoutApi } from '../workoutApi';
import type { ExerciseRead } from '../../../types/exercise';
import { VALID_EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from '../../../types/exercise';
import { CustomExerciseModal } from './CustomExerciseModal';
import { DeleteCustomExerciseModal } from './DeleteCustomExerciseModal';
import { getErrorMessage } from '../../../utils/errorHandling';
import { useAuth } from '../../../context/AuthContext';

export const ExerciseCatalogView: React.FC = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseRead[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseRead | null>(null);
  const [deletingExercise, setDeletingExercise] = useState<ExerciseRead | null>(null);
  const [inspectingExercise, setInspectingExercise] = useState<ExerciseRead | null>(null);

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
    fetchExercises();
  }, [fetchExercises]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchExercises();
  };

  const isOwner = (exercise: ExerciseRead): boolean => {
    if (!exercise.created_by_user_id) return false;
    return exercise.created_by_user_id === user?.id;
  };

  return (
    <div className="exercise-catalog-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Search Bar & Actions */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Exercise Catalog</h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', marginTop: '0.2rem' }}>
              Explore system exercises or build custom movements tailored to your training.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Create Custom Exercise
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            className="form-input"
            aria-label="Search exercise catalog"
            placeholder="Search exercises by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <select
            aria-label="Filter category"
            className="form-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '160px' }}
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
            aria-label="Filter muscle"
            className="form-input"
            placeholder="Muscle (e.g. chest)"
            value={selectedMuscle}
            onChange={(e) => setSelectedMuscle(e.target.value)}
            style={{ width: '150px' }}
          />
          <button type="submit" className="btn btn-secondary" disabled={isLoading}>
            Search
          </button>
        </form>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '1rem',
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={fetchExercises}
            style={{
              background: 'none',
              border: 'none',
              color: '#b91c1c',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Exercise Grid */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          Loading exercise catalog...
        </div>
      ) : exercises.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#1e293b' }}>
            No exercises found matching your criteria.
          </h3>
          <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.875rem', color: '#64748b' }}>
            Try adjusting your search terms or create a custom exercise.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create New Custom Exercise
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem',
          }}
        >
          {exercises.map((exercise) => {
            const userOwns = isOwner(exercise);
            return (
              <div
                key={exercise.id}
                data-testid={`exercise-card-${exercise.id}`}
                style={{
                  background: 'var(--color-surface, #ffffff)',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{exercise.name}</h3>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
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
                      {exercise.is_verified ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: '#e0f2fe',
                            color: '#0369a1',
                          }}
                        >
                          Verified
                        </span>
                      ) : (
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
                  </div>
                </div>

                <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  {exercise.muscle_groups?.length > 0 && (
                    <div>
                      <strong>Target:</strong> {exercise.muscle_groups.join(', ')}
                    </div>
                  )}
                  {exercise.equipment && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <strong>Equipment:</strong> {exercise.equipment}
                    </div>
                  )}
                </div>

                {exercise.description && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.825rem',
                      color: '#475569',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {exercise.description}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setInspectingExercise(exercise)}
                    aria-label={`View details of ${exercise.name}`}
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                  >
                    Details
                  </button>

                  {userOwns && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditingExercise(exercise)}
                        aria-label={`Edit ${exercise.name}`}
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setDeletingExercise(exercise)}
                        aria-label={`Delete ${exercise.name}`}
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exercise Detail Inspect Modal */}
      {inspectingExercise && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-exercise-title"
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
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 id="inspect-exercise-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                {inspectingExercise.name}
              </h2>
              <button
                type="button"
                onClick={() => setInspectingExercise(null)}
                aria-label="Close modal"
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div>
                <strong>Category:</strong>{' '}
                <span style={{ textTransform: 'capitalize' }}>{inspectingExercise.category}</span>
              </div>
              {inspectingExercise.muscle_groups?.length > 0 && (
                <div>
                  <strong>Target Muscle Groups:</strong> {inspectingExercise.muscle_groups.join(', ')}
                </div>
              )}
              {inspectingExercise.equipment && (
                <div>
                  <strong>Equipment Required:</strong> {inspectingExercise.equipment}
                </div>
              )}
              {inspectingExercise.description && (
                <div>
                  <strong>Description:</strong>
                  <p style={{ margin: '0.25rem 0 0', color: '#475569' }}>
                    {inspectingExercise.description}
                  </p>
                </div>
              )}
              {inspectingExercise.instructions && (
                <div>
                  <strong>Form & Instructions:</strong>
                  <p style={{ margin: '0.25rem 0 0', color: '#475569', whiteSpace: 'pre-wrap' }}>
                    {inspectingExercise.instructions}
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setInspectingExercise(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Exercise Modal */}
      {isCreateModalOpen && (
        <CustomExerciseModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            fetchExercises();
          }}
        />
      )}

      {/* Edit Custom Exercise Modal */}
      {editingExercise && (
        <CustomExerciseModal
          isOpen={Boolean(editingExercise)}
          existingExercise={editingExercise}
          onClose={() => setEditingExercise(null)}
          onSuccess={() => {
            fetchExercises();
          }}
        />
      )}

      {/* Delete Custom Exercise Modal */}
      {deletingExercise && (
        <DeleteCustomExerciseModal
          isOpen={Boolean(deletingExercise)}
          exercise={deletingExercise}
          onClose={() => setDeletingExercise(null)}
          onSuccess={() => {
            fetchExercises();
          }}
        />
      )}
    </div>
  );
};
