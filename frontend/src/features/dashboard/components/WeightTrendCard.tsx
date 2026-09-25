import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { WeightHistoryResponse } from '../../../types/progress';
import { formatDate } from '../../../utils/date';

export interface WeightTrendCardProps {
  data: WeightHistoryResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export const WeightTrendCard: React.FC<WeightTrendCardProps> = ({
  data,
  isLoading,
  error,
  onRetry,
}) => {
  const entries = data?.entries || [];
  const currentWeight = data?.current_weight_kg ? Number(data.current_weight_kg) : null;
  const startWeight = data?.start_weight_kg ? Number(data.start_weight_kg) : null;
  const trend = data?.trend;

  // Format data points for Recharts
  const chartData = entries.map((e) => ({
    date: formatDate(e.date),
    rawDate: e.date,
    weight: Number(e.weight_kg),
  }));

  return (
    <article
      aria-labelledby="weight-trend-heading"
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
        <h2 id="weight-trend-heading" style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
          Weight Trend
        </h2>
        {trend && (
          <span
            data-testid="weight-trend-badge"
            style={{
              fontSize: 'var(--font-size-xs)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-primary-text)',
              textTransform: 'capitalize',
            }}
          >
            Trend: {trend}
          </span>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div role="status" aria-label="Loading weight history" style={{ padding: 'var(--spacing-8) 0' }}>
          <div
            style={{
              height: '50px',
              backgroundColor: 'var(--bg-input)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-3)',
              opacity: 0.6,
            }}
          />
          <div
            style={{
              height: '160px',
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
            Retry Weight
          </button>
        </div>
      )}

      {/* Data Loaded */}
      {!isLoading && !error && data && (
        <div>
          {/* Summary Metric Header */}
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-6)',
              marginBottom: 'var(--spacing-4)',
            }}
          >
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
                Current Weight
              </span>
              <span
                data-testid="current-weight-val"
                style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--text-primary)' }}
              >
                {currentWeight !== null ? `${currentWeight.toFixed(1)} kg` : '—'}
              </span>
            </div>

            {startWeight !== null && (
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
                  Starting Weight
                </span>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {startWeight.toFixed(1)} kg
                </span>
              </div>
            )}
          </div>

          {/* Multiple Data Points: Render Chart */}
          {chartData.length >= 2 && (
            <div style={{ width: '100%', height: 200 }} aria-label="Weight progress line chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    fontSize={11}
                    tickLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                    formatter={(val: unknown) => [typeof val === 'number' ? `${val.toFixed(1)} kg` : typeof val === 'string' ? `${val} kg` : '--', 'Weight']}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-primary)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Single Data Point */}
          {chartData.length === 1 && (
            <div
              style={{
                padding: 'var(--spacing-4)',
                backgroundColor: 'var(--bg-input)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              1 entry logged on {chartData[0].date}: <strong>{chartData[0].weight.toFixed(1)} kg</strong>.
              <p style={{ margin: 0, marginTop: 'var(--spacing-1)', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                Log another weight entry to view your trend chart.
              </p>
            </div>
          )}

          {/* Zero Data Points */}
          {chartData.length === 0 && (
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
              No weight entries recorded yet.
            </div>
          )}
        </div>
      )}
    </article>
  );
};
