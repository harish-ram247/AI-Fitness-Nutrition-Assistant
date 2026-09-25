import React, { useState, useEffect, useCallback } from 'react';
import { nutritionApi } from '../nutritionApi';
import { ApiError } from '../../../api/errors';
import { formatDate } from '../../../utils/date';
import type { NutritionHistoryItem } from '../../../types/nutrition';

export const NutritionHistoryView: React.FC = () => {
  const getDefaultRange = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  };

  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(getDefaultRange(7));
  const [historyItems, setHistoryItems] = useState<NutritionHistoryItem[]>([]);
  const [totalDays, setTotalDays] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await nutritionApi.getNutritionHistory(dateRange.from, dateRange.to);
      setHistoryItems(res?.items || []);
      setTotalDays(res?.total_days || 0);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load nutrition history.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleQuickPreset = (days: number) => {
    setDateRange(getDefaultRange(days));
  };

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
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Nutrition History
          </h2>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 'var(--spacing-1) 0 0 0' }}>
            Aggregated historical daily calories and macronutrient breakdown.
          </p>
        </div>

        {/* Date Preset Buttons */}
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          {[
            { label: '7 Days', days: 7 },
            { label: '14 Days', days: 14 },
            { label: '30 Days', days: 30 },
          ].map((preset) => (
            <button
              key={preset.days}
              type="button"
              onClick={() => handleQuickPreset(preset.days)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: 'var(--spacing-1) var(--spacing-3)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                cursor: 'pointer',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range Inputs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-5)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <label htmlFor="history_from_date" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            From:
          </label>
          <input
            id="history_from_date"
            type="date"
            value={dateRange.from}
            onChange={(e) => e.target.value && setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
          <label htmlFor="history_to_date" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            To:
          </label>
          <input
            id="history_to_date"
            type="date"
            value={dateRange.to}
            onChange={(e) => e.target.value && setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            style={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-primary)',
            }}
          />
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
            marginBottom: 'var(--spacing-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadHistory}
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
            Retry History
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div
          data-testid="history-loading"
          style={{
            padding: 'var(--spacing-8)',
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
            Loading nutrition history...
          </span>
        </div>
      ) : (historyItems || []).length === 0 ? (
        /* Empty state */
        <div
          data-testid="history-empty"
          style={{
            textAlign: 'center',
            padding: 'var(--spacing-8) var(--spacing-4)',
            backgroundColor: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: 'var(--spacing-2)' }}>📅</span>
          <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--spacing-1) 0' }}>
            No History for Selected Range
          </h3>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            No nutrition history recorded for this period.
          </p>
        </div>
      ) : (
        /* History Table */
        <div>
          <div style={{ marginBottom: 'var(--spacing-3)', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
            Showing {totalDays} recorded day{totalDays > 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
            {historyItems.map((item) => (
              <div
                key={item.date}
                data-testid={`history-item-${item.date}`}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-2)',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {formatDate(item.date)}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', display: 'block' }}>
                    Protein: {item.protein_g}g · Carbs: {item.carbs_g}g · Fat: {item.fat_g}g
                  </span>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {Math.round(item.calories)} <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400 }}>kcal</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
