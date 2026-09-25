import React from 'react';
import type { DailyTotals } from '../../../types/nutrition';

interface DailySummaryCardProps {
  date: string;
  totals: DailyTotals | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onDateChange: (newDate: string) => void;
}

export const DailySummaryCard: React.FC<DailySummaryCardProps> = ({
  date,
  totals,
  isLoading,
  error,
  onRetry,
  onDateChange,
}) => {
  const handlePrevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-6)',
        marginBottom: 'var(--spacing-6)',
      }}
    >
      {/* Date Navigation Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 'var(--spacing-4)',
          marginBottom: 'var(--spacing-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <button
            type="button"
            onClick={handlePrevDay}
            aria-label="Previous day"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: 'var(--spacing-1) var(--spacing-3)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            ←
          </button>
          <button
            type="button"
            onClick={handleNextDay}
            aria-label="Next day"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: 'var(--spacing-1) var(--spacing-3)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            →
          </button>
          <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'var(--spacing-2)' }}>
            {formattedDate}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            aria-label="Select summary date"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              fontSize: 'var(--font-size-xs)',
            }}
          />
          <button
            type="button"
            onClick={handleToday}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-primary)',
              padding: 'var(--spacing-1) var(--spacing-3)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div
          data-testid="daily-nutrition-loading"
          style={{
            padding: 'var(--spacing-6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--spacing-3)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            Loading daily nutrition totals...
          </span>
        </div>
      ) : totals ? (
        /* Totals Grid */
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 'var(--spacing-4)',
              textAlign: 'center',
            }}
          >
            {/* Calories */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Calories
              </span>
              <div
                data-testid="total-calories-value"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)', marginTop: 'var(--spacing-1)' }}
              >
                {Math.round(totals.calories)} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>kcal</span>
              </div>
            </div>

            {/* Protein */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Protein
              </span>
              <div
                data-testid="total-protein-value"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 'var(--spacing-1)' }}
              >
                {Number(totals.protein_g).toFixed(1)} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>g</span>
              </div>
            </div>

            {/* Carbs */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Carbs
              </span>
              <div
                data-testid="total-carbs-value"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 'var(--spacing-1)' }}
              >
                {Number(totals.carbs_g).toFixed(1)} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>g</span>
              </div>
            </div>

            {/* Fat */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fat
              </span>
              <div
                data-testid="total-fat-value"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)', marginTop: 'var(--spacing-1)' }}
              >
                {Number(totals.fat_g).toFixed(1)} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>g</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
