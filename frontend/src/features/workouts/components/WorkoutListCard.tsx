import React from 'react';
import type { WorkoutSessionRead } from '../../../types/workout';

interface WorkoutListCardProps {
  workout: WorkoutSessionRead;
  onOpen: (workout: WorkoutSessionRead) => void;
  onEdit: (workout: WorkoutSessionRead) => void;
  onDelete: (workout: WorkoutSessionRead) => void;
}

export const WorkoutListCard: React.FC<WorkoutListCardProps> = ({
  workout,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const isInProgress = workout.ended_at === null;

  const formatDate = (isoString: string): string => {
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

  const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  return (
    <div
      className="workout-list-card"
      data-testid={`workout-card-${workout.id}`}
      style={{
        background: 'var(--color-surface, #ffffff)',
        border: isInProgress
          ? '2px solid var(--color-primary, #6366f1)'
          : '1px solid var(--color-border, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: isInProgress
          ? '0 4px 12px rgba(99, 102, 241, 0.15)'
          : '0 2px 4px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--color-text, #1e293b)',
              }}
            >
              {workout.name?.trim() || 'Untitled Workout'}
            </h3>
            {isInProgress && (
              <span
                style={{
                  background: '#fef3c7',
                  color: '#92400e',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                In Progress
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-text-muted, #64748b)',
              marginTop: '0.25rem',
            }}
          >
            <span>Started: {formatDate(workout.started_at)}</span>
            {workout.ended_at && <span> · Ended: {formatDate(workout.ended_at)}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {workout.duration_minutes !== null && workout.duration_minutes !== undefined ? (
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-primary, #6366f1)',
                background: 'rgba(99, 102, 241, 0.08)',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
              }}
            >
              ⏱ {workout.duration_minutes} min
            </span>
          ) : isInProgress ? (
            <span
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#d97706',
                background: '#fef3c7',
                padding: '0.25rem 0.6rem',
                borderRadius: '6px',
              }}
            >
              Active Session
            </span>
          ) : null}
        </div>
      </div>

      {workout.notes && (
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary, #475569)',
            fontStyle: 'italic',
          }}
        >
          &ldquo;{workout.notes}&rdquo;
        </p>
      )}

      {workout.tags && workout.tags.length > 0 && (
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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '0.25rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid var(--color-border, #f1f5f9)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #64748b)' }}>
          {workout.exercises.length} {workout.exercises.length === 1 ? 'exercise' : 'exercises'} · {totalSets}{' '}
          {totalSets === 1 ? 'set' : 'sets'}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onEdit(workout)}
            aria-label={`Edit workout ${workout.name || 'session'}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onDelete(workout)}
            aria-label={`Delete workout ${workout.name || 'session'}`}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onOpen(workout)}
            aria-label={`Open workout details ${workout.name || ''}`.trim()}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.875rem',
              borderRadius: '6px',
              fontWeight: 500,
            }}
          >
            Open Details →
          </button>
        </div>
      </div>
    </div>
  );
};
