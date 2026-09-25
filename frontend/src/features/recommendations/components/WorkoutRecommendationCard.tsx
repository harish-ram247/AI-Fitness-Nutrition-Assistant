import React, { useState } from 'react';
import type { WorkoutRecommendationItem } from '../../../types/recommendation';
import { WORKOUT_TYPE_LABELS } from '../../../types/recommendation';

interface WorkoutRecommendationCardProps {
  item: WorkoutRecommendationItem;
  rankIndex?: number;
}

export const WorkoutRecommendationCard: React.FC<WorkoutRecommendationCardProps> = ({ item, rankIndex }) => {
  const [showFactors, setShowFactors] = useState(false);

  const displayRank = item.ai_rank !== null && item.ai_rank !== undefined ? item.ai_rank : rankIndex;
  const typeLabel =
    WORKOUT_TYPE_LABELS[item.workout_type as keyof typeof WORKOUT_TYPE_LABELS] || item.workout_type;

  return (
    <article
      role="article"
      aria-labelledby={`workout-card-title-${item.id}`}
      style={{
        background: 'var(--bg-card, rgba(17, 24, 39, 0.85))',
        border: '1px solid var(--border-subtle, #2d3748)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '1.25rem',
        marginBottom: '1rem',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.2))',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            {displayRank !== undefined && (
              <span
                style={{
                  background: item.ai_rank ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: item.ai_rank ? 'var(--color-primary-text, #ffffff)' : 'var(--text-secondary, #9ca3af)',
                  border: item.ai_rank ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle, #2d3748)',
                  fontSize: 'var(--font-size-xs, 0.75rem)',
                  fontWeight: 700,
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                }}
              >
                {item.ai_rank ? `AI Rank #${item.ai_rank}` : `#${displayRank}`}
              </span>
            )}
            <span
              style={{
                textTransform: 'capitalize',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--color-primary, #6366f1)',
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm, 4px)',
              }}
            >
              {typeLabel}
            </span>
            <span
              style={{
                textTransform: 'capitalize',
                fontSize: '0.7rem',
                color: 'var(--text-muted, #6b7280)',
              }}
            >
              · {item.category}
            </span>
          </div>

          <h4
            id={`workout-card-title-${item.id}`}
            style={{
              margin: 0,
              fontSize: 'var(--font-size-lg, 1.125rem)',
              fontWeight: 600,
              color: 'var(--text-primary, #f9fafb)',
            }}
          >
            {item.name}
          </h4>
        </div>

        {/* Fit Score */}
        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              fontSize: 'var(--font-size-xs, 0.75rem)',
              color: 'var(--text-muted, #6b7280)',
              display: 'block',
            }}
          >
            Fit Score
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-base, 1rem)',
              fontWeight: 700,
              color: 'var(--color-success, #10b981)',
            }}
          >
            {(item.score * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Program Summary Stats */}
      <div
        role="group"
        aria-label="Workout metadata"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
          gap: '0.5rem',
          background: 'var(--bg-surface, #111827)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-subtle, #2d3748)',
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Estimated Duration
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: 'var(--text-primary, #f9fafb)' }}>
            ⏱ {item.estimated_duration_minutes} min
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Total Volume
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: 'var(--text-primary, #f9fafb)' }}>
            {item.total_sets} sets ({item.exercises.length} exercises)
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Program Variant
          </span>
          <strong style={{ fontSize: 'var(--font-size-sm, 0.875rem)', color: 'var(--text-secondary, #9ca3af)', textTransform: 'capitalize' }}>
            {item.variant}
          </strong>
        </div>
      </div>

      {/* Target Muscles & Equipment Chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: 'var(--font-size-xs, 0.75rem)' }}>
        {item.target_muscle_groups.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Muscles:</span>
            {item.target_muscle_groups.map((muscle) => (
              <span
                key={muscle}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary, #9ca3af)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                }}
              >
                {muscle}
              </span>
            ))}
          </div>
        )}

        {item.primary_equipment_needed.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted, #6b7280)', fontWeight: 600 }}>Equipment:</span>
            {item.primary_equipment_needed.map((eq) => (
              <span
                key={eq}
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  color: 'var(--color-warning, #f59e0b)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                }}
              >
                {eq}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* AI Explanation Callout if present */}
      {item.ai_explanation && (
        <div
          role="region"
          aria-label={`AI coaching explanation for ${item.name}`}
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
            borderLeft: '3px solid var(--color-primary, #6366f1)',
            padding: '0.75rem 1rem',
            borderRadius: '0 var(--radius-md, 8px) var(--radius-md, 8px) 0',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-xs, 0.75rem)',
              fontWeight: 600,
              color: 'var(--color-primary, #6366f1)',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span aria-hidden="true">💡</span> AI Coaching Note
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-sm, 0.875rem)',
              color: 'var(--text-primary, #f9fafb)',
              lineHeight: 1.5,
            }}
          >
            {item.ai_explanation}
          </p>
        </div>
      )}

      {/* Programmed Exercises List */}
      <div>
        <h5
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            color: 'var(--text-secondary, #9ca3af)',
          }}
        >
          Exercise Program ({item.exercises.length} Movements)
        </h5>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {item.exercises.map((ex) => (
            <li
              key={ex.exercise_id || ex.order_index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0.75rem',
                background: 'var(--bg-surface, #111827)',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: 'var(--font-size-sm, 0.875rem)',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted, #6b7280)', marginRight: '0.5rem', fontWeight: 600 }}>
                  #{ex.order_index + 1}
                </span>
                <strong style={{ color: 'var(--text-primary, #f9fafb)' }}>{ex.exercise_name}</strong>
                {ex.equipment && (
                  <span style={{ color: 'var(--text-muted, #6b7280)', fontSize: 'var(--font-size-xs, 0.75rem)', marginLeft: '0.5rem' }}>
                    ({ex.equipment})
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-secondary, #9ca3af)' }}>
                <span>
                  <strong>{ex.recommended_sets}</strong> sets
                </span>
                {ex.recommended_reps !== null && ex.recommended_reps !== undefined && (
                  <span>
                    <strong>{ex.recommended_reps}</strong> reps
                  </span>
                )}
                {ex.recommended_duration_seconds !== null && ex.recommended_duration_seconds !== undefined && (
                  <span>
                    <strong>{ex.recommended_duration_seconds}s</strong> duration
                  </span>
                )}
                <span>{ex.recommended_rest_seconds}s rest</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Reasons & Factors */}
      {item.reasons.length > 0 && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {item.reasons.map((reason, idx) => (
            <span
              key={idx}
              style={{
                fontSize: 'var(--font-size-xs, 0.75rem)',
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--color-success, #10b981)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '0.15rem 0.5rem',
              }}
            >
              ✓ {reason}
            </span>
          ))}
        </div>
      )}

      {/* Factor Breakdown Toggle */}
      {item.factor_scores.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowFactors((prev) => !prev)}
            aria-expanded={showFactors}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary, #6366f1)',
              fontSize: 'var(--font-size-xs, 0.75rem)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {showFactors ? '▾ Hide Scoring Factors' : '▸ View Scoring Factors'}
          </button>

          {showFactors && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                background: 'var(--bg-surface, #111827)',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: 'var(--font-size-xs, 0.75rem)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              {item.factor_scores.map((factor, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary, #9ca3af)' }}>
                    {factor.factor_name}:
                  </span>
                  <span style={{ color: 'var(--text-primary, #f9fafb)', fontWeight: 600 }}>
                    {(factor.normalized_score * 100).toFixed(0)}% (wt: {factor.weight})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
