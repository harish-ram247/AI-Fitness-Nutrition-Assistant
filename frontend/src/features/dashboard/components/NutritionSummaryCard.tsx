import React from 'react';
import { Link } from 'react-router-dom';
import { DailyNutritionSummaryResponse } from '../../../types/nutrition';
import { MacroSummary } from './MacroSummary';

export interface NutritionSummaryCardProps {
  data: DailyNutritionSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const NutritionSummaryCard: React.FC<NutritionSummaryCardProps> = ({
  data,
  isLoading,
  error,
  onRetry,
}) => {
  return (
    <article
      aria-labelledby="nutrition-summary-heading"
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
        <h2 id="nutrition-summary-heading" style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
          Today&apos;s Nutrition
        </h2>
        <Link
          to="/nutrition"
          style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}
          aria-label="Go to Nutrition page"
        >
          View Full Log &rarr;
        </Link>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div role="status" aria-label="Loading nutrition data" style={{ padding: 'var(--spacing-6) 0' }}>
          <div
            style={{
              height: '80px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-3)',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              height: '140px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              opacity: 0.6,
            }}
          />
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
            Retry Nutrition
          </button>
        </div>
      )}

      {/* Data Loaded */}
      {!isLoading && !error && data && (
        <div>
          <MacroSummary totals={data.totals} />

          {/* Meal Breakdown List */}
          <div style={{ marginTop: 'var(--spacing-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--spacing-3)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 'var(--spacing-2)' }}>
              Meal Breakdown
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-2)' }}>
              {Object.entries(data.meals || {}).map(([mealType, summary]) => {
                const count = summary?.entries?.length || 0;
                const cals = Math.round(Number(summary?.calories) || 0);
                return (
                  <div
                    key={mealType}
                    style={{
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      backgroundColor: 'var(--bg-input)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {mealType}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {cals} kcal ({count} {count === 1 ? 'item' : 'items'})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty Fallback */}
      {!isLoading && !error && !data && (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-6) 0', color: 'var(--text-muted)' }}>
          No nutrition data available.
        </div>
      )}
    </article>
  );
};
