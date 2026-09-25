import React from 'react';
import { Link } from 'react-router-dom';
import { WorkoutSessionSummaryResponse } from '../../../types/workout';
import { formatDate } from '../../../utils/date';

export interface RecentWorkoutsCardProps {
  data: WorkoutSessionSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const RecentWorkoutsCard: React.FC<RecentWorkoutsCardProps> = ({
  data,
  isLoading,
  error,
  onRetry,
}) => {
  const sessions = data?.items || [];

  return (
    <article
      aria-labelledby="recent-workouts-heading"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-5)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-4)',
        }}
      >
        <h2 id="recent-workouts-heading" style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
          Recent Workouts
        </h2>
        <Link
          to="/workouts"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
          aria-label="Go to Workouts page"
        >
          View All &rarr;
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div role="status" aria-label="Loading recent workouts" style={{ padding: 'var(--spacing-6) 0' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: '60px',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--spacing-2)',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div
          role="alert"
          style={{
            padding: 'var(--spacing-4)',
            backgroundColor: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-error)',
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center',
            margin: 'auto 0',
          }}
        >
          <p style={{ margin: 0, marginBottom: 'var(--spacing-2)' }}>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              padding: 'var(--spacing-1) var(--spacing-3)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            Retry Workouts
          </button>
        </div>
      )}

      {/* Sessions List */}
      {!isLoading && !error && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          {sessions.map((session) => {
            const exerciseCount = session.exercises?.length || 0;
            const setCount = (session.exercises || []).reduce(
              (acc, ex) => acc + (ex.sets?.length || 0),
              0,
            );

            return (
              <div
                key={session.id}
                style={{
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  backgroundColor: 'var(--bg-input)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-2)',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: 'var(--font-size-base)',
                      fontWeight: 600,
                      margin: 0,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {session.name || 'Workout Session'}
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--spacing-3)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--text-muted)',
                      marginTop: 'var(--spacing-1)',
                    }}
                  >
                    <span>{formatDate(session.started_at)}</span>
                    {session.duration_minutes !== null && session.duration_minutes !== undefined && (
                      <span>{session.duration_minutes} min</span>
                    )}
                    <span>
                      {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                    </span>
                    <span>
                      {setCount} {setCount === 1 ? 'set' : 'sets'}
                    </span>
                  </div>
                </div>

                {session.tags && session.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--spacing-1)', flexWrap: 'wrap' }}>
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: '0.7rem',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && sessions.length === 0 && (
        <div
          style={{
            padding: 'var(--spacing-6)',
            backgroundColor: 'var(--bg-input)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          No workouts logged yet.
          <div style={{ marginTop: 'var(--spacing-2)' }}>
            <Link to="/workouts" style={{ fontSize: 'var(--font-size-xs)' }}>
              Start your first workout &rarr;
            </Link>
          </div>
        </div>
      )}
    </article>
  );
};
