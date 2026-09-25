import React, { useState, useEffect, useCallback } from 'react';
import { workoutApi } from '../workoutApi';
import type {
  WorkoutExerciseRead,
  WorkoutSessionRead,
  WorkoutSetRead,
} from '../../../types/workout';
import type { ExerciseRead } from '../../../types/exercise';
import { SET_TYPE_LABELS } from '../../../types/workout';
import { ExerciseCatalogModal } from './ExerciseCatalogModal';
import { WorkoutExerciseModal } from './WorkoutExerciseModal';
import { DeleteWorkoutExerciseModal } from './DeleteWorkoutExerciseModal';
import { WorkoutSetModal } from './WorkoutSetModal';
import { DeleteWorkoutSetModal } from './DeleteWorkoutSetModal';
import { WorkoutEditModal } from './WorkoutEditModal';
import { WorkoutDeleteModal } from './WorkoutDeleteModal';
import { getErrorMessage } from '../../../utils/errorHandling';

interface WorkoutDetailViewProps {
  workoutId: string;
  onBack: () => void;
  onWorkoutDeleted: () => void;
}

export const WorkoutDetailView: React.FC<WorkoutDetailViewProps> = ({
  workoutId,
  onBack,
  onWorkoutDeleted,
}) => {
  const [workout, setWorkout] = useState<WorkoutSessionRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isEditWorkoutOpen, setIsEditWorkoutOpen] = useState(false);
  const [isDeleteWorkoutOpen, setIsDeleteWorkoutOpen] = useState(false);

  // Exercise selection to add
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [selectedExerciseToAdd, setSelectedExerciseToAdd] = useState<ExerciseRead | null>(null);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [editingExerciseEntry, setEditingExerciseEntry] = useState<WorkoutExerciseRead | null>(null);
  const [deletingExerciseEntry, setDeletingExerciseEntry] = useState<WorkoutExerciseRead | null>(null);

  // Set modals
  const [activeExerciseForSet, setActiveExerciseForSet] = useState<string | null>(null);
  const [editingSet, setEditingSet] = useState<{ exerciseEntryId: string; set: WorkoutSetRead } | null>(null);
  const [deletingSet, setDeletingSet] = useState<{ exerciseEntryId: string; set: WorkoutSetRead } | null>(null);

  const fetchWorkout = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await workoutApi.getWorkout(workoutId);
      setWorkout(data);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  const handleEndWorkout = async () => {
    if (!workout) return;
    try {
      const updated = await workoutApi.updateWorkout(workout.id, {
        ended_at: new Date().toISOString(),
      });
      setWorkout(updated);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const formatDate = (isoString?: string | null): string => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
        Loading workout details...
      </div>
    );
  }

  if (errorMessage && !workout) {
    return (
      <div
        role="alert"
        style={{
          padding: '1.5rem',
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          borderRadius: '8px',
        }}
      >
        <p style={{ margin: 0, fontWeight: 500 }}>{errorMessage}</p>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Back to Workouts
          </button>
          <button type="button" className="btn btn-primary" onClick={fetchWorkout}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!workout) return null;

  const isInProgress = workout.ended_at === null;
  const sortedExercises = [...workout.exercises].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="workout-detail-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Navigation */}
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onBack}
          aria-label="Back to workouts"
          style={{ fontSize: '0.875rem' }}
        >
          ← Back to Workouts
        </button>
      </div>

      {/* Global Error Notice if mutation fails */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
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

      {/* Workout Header Card */}
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          borderRadius: '12px',
          padding: '1.5rem',
          border: '1px solid var(--color-border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
                {workout.name?.trim() || 'Untitled Workout'}
              </h1>
              {isInProgress && (
                <span
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    textTransform: 'uppercase',
                  }}
                >
                  In Progress
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.35rem' }}>
              <span>Started: {formatDate(workout.started_at)}</span>
              {workout.ended_at && <span> · Ended: {formatDate(workout.ended_at)}</span>}
              {workout.duration_minutes !== null && workout.duration_minutes !== undefined && (
                <span style={{ fontWeight: 600, color: 'var(--color-primary, #6366f1)', marginLeft: '0.5rem' }}>
                  ⏱ {workout.duration_minutes} min
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {isInProgress && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEndWorkout}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
              >
                ✓ Complete Workout
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditWorkoutOpen(true)}
            >
              Edit Session
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setIsDeleteWorkoutOpen(true)}
            >
              Delete
            </button>
          </div>
        </div>

        {workout.notes && (
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', fontStyle: 'italic' }}>
            &ldquo;{workout.notes}&rdquo;
          </p>
        )}

        {workout.tags?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {workout.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Exercises Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
          Exercises ({sortedExercises.length})
        </h2>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsCatalogOpen(true)}
        >
          + Add Exercise
        </button>
      </div>

      {/* Exercises List */}
      {sortedExercises.length === 0 ? (
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
            No exercises added to this workout yet
          </h3>
          <p style={{ margin: '0.5rem 0 1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
            Click &ldquo;+ Add Exercise&rdquo; to select from the exercise catalog and start recording sets.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCatalogOpen(true)}
          >
            + Add Exercise
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {sortedExercises.map((entry, idx) => {
            const exerciseName = entry.exercise?.name || `Exercise #${idx + 1}`;
            const sets = [...entry.sets].sort((a, b) => a.set_number - b.set_number);

            return (
              <div
                key={entry.id}
                data-testid={`workout-exercise-${entry.id}`}
                style={{
                  background: 'var(--color-surface, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Exercise Header */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid var(--color-border, #e2e8f0)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--color-primary, #6366f1)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                        {exerciseName}
                      </h3>
                      {entry.exercise?.category && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            background: '#e0e7ff',
                            color: '#3730a3',
                            textTransform: 'capitalize',
                          }}
                        >
                          {entry.exercise.category}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p style={{ margin: '0.25rem 0 0 2rem', fontSize: '0.825rem', color: '#64748b', fontStyle: 'italic' }}>
                        Note: {entry.notes}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingExerciseEntry(entry)}
                      aria-label={`Edit ${exerciseName}`}
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setDeletingExerciseEntry(entry)}
                      aria-label={`Remove ${exerciseName}`}
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setActiveExerciseForSet(entry.id)}
                      aria-label={`Add set to ${exerciseName}`}
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}
                    >
                      + Add Set
                    </button>
                  </div>
                </div>

                {/* Sets Table */}
                <div style={{ padding: '0.5rem 1.25rem 1.25rem', overflowX: 'auto' }}>
                  {sets.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.875rem' }}>
                      No sets logged yet for this exercise.{' '}
                      <button
                        type="button"
                        onClick={() => setActiveExerciseForSet(entry.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary, #6366f1)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Add your first set
                      </button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Set #</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Type</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Weight</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Reps</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Duration</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Distance</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>RPE</th>
                          <th style={{ padding: '0.6rem 0.5rem' }}>Done</th>
                          <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sets.map((s) => (
                          <tr
                            key={s.id}
                            data-testid={`set-row-${s.id}`}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: s.completed ? 'transparent' : '#f8fafc',
                            }}
                          >
                            <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                              #{s.set_number}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                  fontWeight: 500,
                                  background:
                                    s.set_type === 'warmup'
                                      ? '#fef3c7'
                                      : s.set_type === 'drop_set'
                                      ? '#e0e7ff'
                                      : s.set_type === 'failure'
                                      ? '#fee2e2'
                                      : '#f1f5f9',
                                  color:
                                    s.set_type === 'warmup'
                                      ? '#92400e'
                                      : s.set_type === 'drop_set'
                                      ? '#3730a3'
                                      : s.set_type === 'failure'
                                      ? '#991b1b'
                                      : '#334155',
                                }}
                              >
                                {SET_TYPE_LABELS[s.set_type] || s.set_type}
                              </span>
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.weight_kg !== null && s.weight_kg !== undefined
                                ? `${s.weight_kg} kg`
                                : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.reps !== null && s.reps !== undefined ? s.reps : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.duration_seconds !== null && s.duration_seconds !== undefined
                                ? `${s.duration_seconds}s`
                                : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.distance_m !== null && s.distance_m !== undefined
                                ? `${s.distance_m}m`
                                : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.rpe !== null && s.rpe !== undefined ? s.rpe : '—'}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem' }}>
                              {s.completed ? (
                                <span style={{ color: '#16a34a', fontWeight: 700 }} title="Completed">
                                  ✓
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }} title="Not completed">
                                  —
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => setEditingSet({ exerciseEntryId: entry.id, set: s })}
                                  aria-label={`Edit set ${s.set_number}`}
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => setDeletingSet({ exerciseEntryId: entry.id, set: s })}
                                  aria-label={`Delete set ${s.set_number}`}
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem' }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALS */}

      {/* Edit Workout Modal */}
      {isEditWorkoutOpen && (
        <WorkoutEditModal
          workout={workout}
          isOpen={isEditWorkoutOpen}
          onClose={() => setIsEditWorkoutOpen(false)}
          onSuccess={(updated) => {
            setWorkout(updated);
          }}
        />
      )}

      {/* Delete Workout Modal */}
      {isDeleteWorkoutOpen && (
        <WorkoutDeleteModal
          workout={workout}
          isOpen={isDeleteWorkoutOpen}
          onClose={() => setIsDeleteWorkoutOpen(false)}
          onSuccess={() => {
            onWorkoutDeleted();
          }}
        />
      )}

      {/* Exercise Catalog Picker */}
      {isCatalogOpen && (
        <ExerciseCatalogModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
          onSelect={(exercise) => {
            setSelectedExerciseToAdd(exercise);
            setIsExerciseModalOpen(true);
          }}
        />
      )}

      {/* Add / Edit Workout Exercise Modal */}
      {(isExerciseModalOpen || editingExerciseEntry) && (
        <WorkoutExerciseModal
          workoutId={workout.id}
          isOpen={isExerciseModalOpen || Boolean(editingExerciseEntry)}
          exerciseToAdd={selectedExerciseToAdd}
          existingEntry={editingExerciseEntry}
          defaultOrderIndex={workout.exercises.length}
          onClose={() => {
            setIsExerciseModalOpen(false);
            setSelectedExerciseToAdd(null);
            setEditingExerciseEntry(null);
          }}
          onSuccess={() => {
            fetchWorkout();
          }}
        />
      )}

      {/* Delete Workout Exercise Modal */}
      {deletingExerciseEntry && (
        <DeleteWorkoutExerciseModal
          workoutId={workout.id}
          entry={deletingExerciseEntry}
          isOpen={Boolean(deletingExerciseEntry)}
          onClose={() => setDeletingExerciseEntry(null)}
          onSuccess={() => {
            fetchWorkout();
          }}
        />
      )}

      {/* Add Set Modal */}
      {activeExerciseForSet && (
        <WorkoutSetModal
          workoutId={workout.id}
          exerciseEntryId={activeExerciseForSet}
          suggestedSetNumber={
            (workout.exercises.find((e) => e.id === activeExerciseForSet)?.sets.length || 0) + 1
          }
          isOpen={Boolean(activeExerciseForSet)}
          onClose={() => setActiveExerciseForSet(null)}
          onSuccess={() => {
            fetchWorkout();
          }}
        />
      )}

      {/* Edit Set Modal */}
      {editingSet && (
        <WorkoutSetModal
          workoutId={workout.id}
          exerciseEntryId={editingSet.exerciseEntryId}
          existingSet={editingSet.set}
          isOpen={Boolean(editingSet)}
          onClose={() => setEditingSet(null)}
          onSuccess={() => {
            fetchWorkout();
          }}
        />
      )}

      {/* Delete Set Modal */}
      {deletingSet && (
        <DeleteWorkoutSetModal
          workoutId={workout.id}
          exerciseEntryId={deletingSet.exerciseEntryId}
          set={deletingSet.set}
          isOpen={Boolean(deletingSet)}
          onClose={() => setDeletingSet(null)}
          onSuccess={() => {
            fetchWorkout();
          }}
        />
      )}
    </div>
  );
};
