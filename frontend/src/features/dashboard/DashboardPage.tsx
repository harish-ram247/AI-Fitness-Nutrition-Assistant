import React, { useEffect, useState, useCallback } from 'react';
import { dashboardApi } from './dashboardApi';
import { DailyNutritionSummaryResponse } from '../../types/nutrition';
import { WeightHistoryResponse } from '../../types/progress';
import { WorkoutSessionSummaryResponse } from '../../types/workout';
import { getTodayDateString } from '../../utils/date';
import { DashboardHeader } from './components/DashboardHeader';
import { NutritionSummaryCard } from './components/NutritionSummaryCard';
import { WeightTrendCard } from './components/WeightTrendCard';
import { RecentWorkoutsCard } from './components/RecentWorkoutsCard';
import { apiClient } from '../../api/client';
import { ApiError } from '../../api/errors';

export const DashboardPage: React.FC = () => {
  // 1. Nutrition state
  const [nutrition, setNutrition] = useState<DailyNutritionSummaryResponse | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(true);
  const [nutritionError, setNutritionError] = useState<string | null>(null);

  // 2. Weight state
  const [weight, setWeight] = useState<WeightHistoryResponse | null>(null);
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightError, setWeightError] = useState<string | null>(null);

  // 3. Workouts state
  const [workouts, setWorkouts] = useState<WorkoutSessionSummaryResponse | null>(null);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [workoutsError, setWorkoutsError] = useState<string | null>(null);

  // 4. Dev health verification state (Phase 8A verification compatibility)
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const fetchNutrition = useCallback(async () => {
    setNutritionLoading(true);
    setNutritionError(null);
    try {
      const today = getTodayDateString();
      const res = await dashboardApi.getDailyNutrition(today);
      setNutrition(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setNutritionError(`Failed to load nutrition: ${err.message}`);
      } else if (err instanceof Error) {
        setNutritionError(err.message);
      } else {
        setNutritionError('Failed to load daily nutrition');
      }
    } finally {
      setNutritionLoading(false);
    }
  }, []);

  const fetchWeight = useCallback(async () => {
    setWeightLoading(true);
    setWeightError(null);
    try {
      const res = await dashboardApi.getWeightHistory();
      setWeight(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setWeightError(`Failed to load weight: ${err.message}`);
      } else if (err instanceof Error) {
        setWeightError(err.message);
      } else {
        setWeightError('Failed to load weight history');
      }
    } finally {
      setWeightLoading(false);
    }
  }, []);

  const fetchWorkouts = useCallback(async () => {
    setWorkoutsLoading(true);
    setWorkoutsError(null);
    try {
      const res = await dashboardApi.getRecentWorkouts(3);
      setWorkouts(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setWorkoutsError(`Failed to load workouts: ${err.message}`);
      } else if (err instanceof Error) {
        setWorkoutsError(err.message);
      } else {
        setWorkoutsError('Failed to load recent workouts');
      }
    } finally {
      setWorkoutsLoading(false);
    }
  }, []);

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const result = await apiClient.get<{ status: string }>('/api/v1/health');
      setHealthStatus(result?.status || 'healthy');
    } catch (err) {
      if (err instanceof ApiError) {
        setHealthError(`API Error (${err.status}): ${err.message}`);
      } else if (err instanceof Error) {
        setHealthError(err.message);
      } else {
        setHealthError('Unknown health check failure');
      }
    } finally {
      setHealthLoading(false);
    }
  };

  // On mount, load each independent domain resource in parallel
  useEffect(() => {
    fetchNutrition();
    fetchWeight();
    fetchWorkouts();
  }, [fetchNutrition, fetchWeight, fetchWorkouts]);

  return (
    <div>
      <DashboardHeader />

      {/* Main Responsive Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
          gap: 'var(--spacing-6)',
          alignItems: 'start',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <NutritionSummaryCard
          data={nutrition}
          isLoading={nutritionLoading}
          error={nutritionError}
          onRetry={fetchNutrition}
        />

        <WeightTrendCard
          data={weight}
          isLoading={weightLoading}
          error={weightError}
          onRetry={fetchWeight}
        />
      </div>

      {/* Recent Workouts Section */}
      <div style={{ marginBottom: 'var(--spacing-8)' }}>
        <RecentWorkoutsCard
          data={workouts}
          isLoading={workoutsLoading}
          error={workoutsError}
          onRetry={fetchWorkouts}
        />
      </div>

      {/* Development Health Verification Tool (Phase 8A preservation) */}
      <section
        style={{
          marginTop: 'var(--spacing-8)',
          padding: 'var(--spacing-4)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)',
        }}
        aria-label="Development API Health Verification"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
          <span>API Connection Diagnostic: <code>GET /api/v1/health</code></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
            <button
              type="button"
              onClick={checkHealth}
              disabled={healthLoading}
              aria-label="Verify Backend Health"
              style={{
                fontSize: 'var(--font-size-xs)',
                padding: 'var(--spacing-1) var(--spacing-2)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {healthLoading ? 'Checking...' : 'Check API Health'}
            </button>
            {healthStatus && (
              <span data-testid="health-status" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                Status: {healthStatus}
              </span>
            )}
            {healthError && (
              <span data-testid="health-error" style={{ color: 'var(--color-error)' }}>
                {healthError}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
