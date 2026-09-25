import React, { useState, useEffect, useCallback } from 'react';
import { workoutApi } from './workoutApi';
import type { WorkoutSessionRead } from '../../types/workout';
import { WorkoutListCard } from './components/WorkoutListCard';
import { WorkoutCreateModal } from './components/WorkoutCreateModal';
import { WorkoutEditModal } from './components/WorkoutEditModal';
import { WorkoutDeleteModal } from './components/WorkoutDeleteModal';
import { WorkoutDetailView } from './components/WorkoutDetailView';
import { ExerciseCatalogView } from './components/ExerciseCatalogView';
import { getErrorMessage } from '../../utils/errorHandling';

type ActiveTab = 'workouts' | 'exercises';

export const WorkoutsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('workouts');
  const [workouts, setWorkouts] = useState<WorkoutSessionRead[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutSessionRead | null>(null);
  const [deletingWorkout, setDeletingWorkout] = useState<WorkoutSessionRead | null>(null);

  const fetchWorkouts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const resp = await workoutApi.listWorkouts({ page: 1, size: 50 });
      setWorkouts(resp.items);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'workouts') {
      fetchWorkouts();
    }
  }, [activeTab, fetchWorkouts]);

  // Find active in-progress workout session
  const inProgressSession = workouts.find((w) => w.ended_at === null);

  const handleEndSessionQuick = async (session: WorkoutSessionRead) => {
    try {
      await workoutApi.updateWorkout(session.id, {
        ended_at: new Date().toISOString(),
      });
      fetchWorkouts();
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  // If viewing details of a specific workout
  if (selectedWorkoutId) {
    return (
      <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
        <WorkoutDetailView
          workoutId={selectedWorkoutId}
          onBack={() => {
            setSelectedWorkoutId(null);
            fetchWorkouts();
          }}
          onWorkoutDeleted={() => {
            setSelectedWorkoutId(null);
            fetchWorkouts();
          }}
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '1.5rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
            Workouts & Exercise Tracking
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-muted, #64748b)', fontSize: '0.9rem' }}>
            Plan, log, and review your training sessions, exercises, and sets.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + Start / Log Workout
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('workouts')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'workouts' ? 600 : 500,
            color: activeTab === 'workouts' ? 'var(--color-primary, #6366f1)' : '#64748b',
            borderBottom: activeTab === 'workouts' ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Workout History
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exercises')}
          style={{
            padding: '0.6rem 1.25rem',
            border: 'none',
            background: 'none',
            fontWeight: activeTab === 'exercises' ? 600 : 500,
            color: activeTab === 'exercises' ? 'var(--color-primary, #6366f1)' : '#64748b',
            borderBottom: activeTab === 'exercises' ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '0.95rem',
          }}
        >
          Exercise Catalog
        </button>
      </div>

      {activeTab === 'exercises' ? (
        <ExerciseCatalogView />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Workout Banner */}
          {inProgressSession && (
            <div
              style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#16a34a',
                      display: 'inline-block',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                  <strong style={{ fontSize: '1rem', color: '#92400e' }}>Active Workout in Progress</strong>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#78350f', marginTop: '0.25rem' }}>
                  {inProgressSession.name || 'Untitled Session'} · Started{' '}
                  {new Date(inProgressSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleEndSessionQuick(inProgressSession)}
                  style={{ background: '#ffffff', borderColor: '#fcd34d', color: '#92400e', fontSize: '0.875rem' }}
                >
                  ✓ Finish Workout
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setSelectedWorkoutId(inProgressSession.id)}
                  style={{ fontSize: '0.875rem' }}
                >
                  Resume Session →
                </button>
              </div>
            </div>
          )}

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
                onClick={fetchWorkouts}
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

          {/* Workout History List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              Loading workout history...
            </div>
          ) : workouts.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '3.5rem 1.5rem',
                background: 'var(--color-surface, #ffffff)',
                borderRadius: '12px',
                border: '1px solid var(--color-border, #e2e8f0)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                No workouts recorded yet
              </h3>
              <p style={{ margin: '0.5rem 0 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                Start tracking your exercises, sets, weights, and reps to monitor your progress over time.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsCreateModalOpen(true)}
              >
                + Start Your First Workout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workouts.map((workout) => (
                <WorkoutListCard
                  key={workout.id}
                  workout={workout}
                  onOpen={(w) => setSelectedWorkoutId(w.id)}
                  onEdit={(w) => setEditingWorkout(w)}
                  onDelete={(w) => setDeletingWorkout(w)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* Create Workout Modal */}
      {isCreateModalOpen && (
        <WorkoutCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(created) => {
            fetchWorkouts();
            setSelectedWorkoutId(created.id);
          }}
        />
      )}

      {/* Edit Workout Modal */}
      {editingWorkout && (
        <WorkoutEditModal
          workout={editingWorkout}
          isOpen={Boolean(editingWorkout)}
          onClose={() => setEditingWorkout(null)}
          onSuccess={() => {
            fetchWorkouts();
          }}
        />
      )}

      {/* Delete Workout Modal */}
      {deletingWorkout && (
        <WorkoutDeleteModal
          workout={deletingWorkout}
          isOpen={Boolean(deletingWorkout)}
          onClose={() => setDeletingWorkout(null)}
          onSuccess={() => {
            fetchWorkouts();
          }}
        />
      )}
    </div>
  );
};
