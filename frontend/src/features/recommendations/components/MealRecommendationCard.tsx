import React, { useState } from 'react';
import type { MealRecommendationItem } from '../../../types/recommendation';

interface MealRecommendationCardProps {
  item: MealRecommendationItem;
  rankIndex?: number;
}

export const MealRecommendationCard: React.FC<MealRecommendationCardProps> = ({ item, rankIndex }) => {
  const [showFactors, setShowFactors] = useState(false);

  const displayRank = item.ai_rank !== null && item.ai_rank !== undefined ? item.ai_rank : rankIndex;

  return (
    <article
      role="article"
      aria-labelledby={`meal-card-title-${item.id}`}
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
                textTransform: 'uppercase',
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-muted, #6b7280)',
                padding: '0.15rem 0.45rem',
                borderRadius: 'var(--radius-sm, 4px)',
              }}
            >
              {item.meal_type}
            </span>
          </div>

          <h4
            id={`meal-card-title-${item.id}`}
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

        {/* Deterministic score */}
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

      {/* Macronutrient Summary Grid */}
      <div
        role="group"
        aria-label="Nutritional totals"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
          gap: '0.5rem',
          background: 'var(--bg-surface, #111827)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md, 8px)',
          border: '1px solid var(--border-subtle, #2d3748)',
        }}
      >
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Calories
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: 'var(--text-primary, #f9fafb)' }}>
            {item.total_calories} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>kcal</span>
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Protein
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: '#38bdf8' }}>
            {item.total_protein_g} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>g</span>
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Carbs
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: '#fbbf24' }}>
            {item.total_carbs_g} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>g</span>
          </strong>
        </div>
        <div>
          <span style={{ fontSize: 'var(--font-size-xs, 0.75rem)', color: 'var(--text-muted, #6b7280)', display: 'block' }}>
            Fat
          </span>
          <strong style={{ fontSize: 'var(--font-size-base, 1rem)', color: '#f87171' }}>
            {item.total_fat_g} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>g</span>
          </strong>
        </div>
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

      {/* Components Breakdown */}
      <div>
        <h5
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            fontWeight: 600,
            color: 'var(--text-secondary, #9ca3af)',
          }}
        >
          Ingredients & Portions ({item.components.length})
        </h5>
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          {item.components.map((comp, idx) => (
            <li
              key={comp.food_id || idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.4rem 0.6rem',
                background: 'var(--bg-surface, #111827)',
                borderRadius: 'var(--radius-sm, 4px)',
                fontSize: 'var(--font-size-sm, 0.875rem)',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: 'var(--text-primary, #f9fafb)', fontWeight: 500 }}>
                {comp.food_name}
              </span>
              <span style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: 'var(--font-size-xs, 0.75rem)' }}>
                {comp.quantity_g}g ({comp.serving_count} {comp.serving_description}) · {comp.calories} kcal
              </span>
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
