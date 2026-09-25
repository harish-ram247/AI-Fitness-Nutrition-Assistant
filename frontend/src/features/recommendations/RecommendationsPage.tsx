import React, { useEffect, useState, useCallback } from 'react';
import { recommendationApi } from './recommendationApi';
import type {
  MealRecommendationResponse,
  WorkoutRecommendationResponse,
  RecommendationWorkoutType,
} from '../../types/recommendation';
import { VALID_MEAL_TYPES, VALID_WORKOUT_TYPES, WORKOUT_TYPE_LABELS } from '../../types/recommendation';
import { MealRecommendationCard } from './components/MealRecommendationCard';
import { WorkoutRecommendationCard } from './components/WorkoutRecommendationCard';
import { AIExplanationPanel } from './components/AIExplanationPanel';
import { getErrorMessage } from '../../utils/errorHandling';

type TabMode = 'meals' | 'workouts';

export const RecommendationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabMode>('meals');

  // ==========================================
  // MEALS STATE & CONTROLS
  // ==========================================
  const [mealType, setMealType] = useState<string>('lunch');
  const [targetCalories, setTargetCalories] = useState<string>('');
  const [allergiesInput, setAllergiesInput] = useState<string>('');
  const [dislikedFoodsInput, setDislikedFoodsInput] = useState<string>('');
  const [mealLimit, setMealLimit] = useState<number>(10);
  const [mealIncludeAi, setMealIncludeAi] = useState<boolean>(false);

  const [mealData, setMealData] = useState<MealRecommendationResponse | null>(null);
  const [mealLoading, setMealLoading] = useState<boolean>(false);
  const [mealError, setMealError] = useState<string | null>(null);

  // ==========================================
  // WORKOUTS STATE & CONTROLS
  // ==========================================
  const [workoutType, setWorkoutType] = useState<RecommendationWorkoutType | ''>('');
  const [targetDuration, setTargetDuration] = useState<string>('45');
  const [equipmentInput, setEquipmentInput] = useState<string>('');
  const [workoutLimit, setWorkoutLimit] = useState<number>(5);
  const [workoutIncludeAi, setWorkoutIncludeAi] = useState<boolean>(false);

  const [workoutData, setWorkoutData] = useState<WorkoutRecommendationResponse | null>(null);
  const [workoutLoading, setWorkoutLoading] = useState<boolean>(false);
  const [workoutError, setWorkoutError] = useState<string | null>(null);

  // ==========================================
  // FETCH MEALS
  // ==========================================
  const fetchMealRecommendations = useCallback(
    async (options?: { includeAiOverride?: boolean }) => {
      setMealLoading(true);
      setMealError(null);

      const parsedTargetCal = targetCalories.trim() ? parseInt(targetCalories.trim(), 10) : undefined;
      const allergiesList = allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const dislikedList = dislikedFoodsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const includeAi =
        options?.includeAiOverride !== undefined ? options.includeAiOverride : mealIncludeAi;

      try {
        const response = await recommendationApi.getMealRecommendations({
          meal_type: mealType || undefined,
          target_calories: !isNaN(parsedTargetCal as number) ? parsedTargetCal : undefined,
          allergies: allergiesList.length > 0 ? allergiesList : undefined,
          disliked_foods: dislikedList.length > 0 ? dislikedList : undefined,
          limit: mealLimit,
          include_ai: includeAi,
        });
        setMealData(response);
      } catch (err) {
        setMealError(getErrorMessage(err));
      } finally {
        setMealLoading(false);
      }
    },
    [mealType, targetCalories, allergiesInput, dislikedFoodsInput, mealLimit, mealIncludeAi],
  );

  // ==========================================
  // FETCH WORKOUTS
  // ==========================================
  const fetchWorkoutRecommendations = useCallback(
    async (options?: { includeAiOverride?: boolean }) => {
      setWorkoutLoading(true);
      setWorkoutError(null);

      const parsedDuration = targetDuration.trim() ? parseInt(targetDuration.trim(), 10) : undefined;
      const eqList = equipmentInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const includeAi =
        options?.includeAiOverride !== undefined ? options.includeAiOverride : workoutIncludeAi;

      try {
        const response = await recommendationApi.getWorkoutRecommendations({
          target_duration_minutes: !isNaN(parsedDuration as number) ? parsedDuration : undefined,
          workout_type: workoutType || undefined,
          equipment: eqList.length > 0 ? eqList : undefined,
          limit: workoutLimit,
          include_ai: includeAi,
        });
        setWorkoutData(response);
      } catch (err) {
        setWorkoutError(getErrorMessage(err));
      } finally {
        setWorkoutLoading(false);
      }
    },
    [targetDuration, workoutType, equipmentInput, workoutLimit, workoutIncludeAi],
  );

  // Initial load on mount
  useEffect(() => {
    void fetchMealRecommendations();
  }, []);

  const handleTabChange = (tab: TabMode) => {
    setActiveTab(tab);
    if (tab === 'workouts' && !workoutData && !workoutLoading) {
      void fetchWorkoutRecommendations();
    }
  };

  const handleMealSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchMealRecommendations();
  };

  const handleWorkoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchWorkoutRecommendations();
  };

  const handleMealAiEnrichClick = () => {
    setMealIncludeAi(true);
    void fetchMealRecommendations({ includeAiOverride: true });
  };

  const handleWorkoutAiEnrichClick = () => {
    setWorkoutIncludeAi(true);
    void fetchWorkoutRecommendations({ includeAiOverride: true });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1
            style={{
              fontSize: 'var(--font-size-3xl, 1.875rem)',
              fontWeight: 700,
              color: 'var(--text-primary, #f9fafb)',
              marginBottom: '0.25rem',
            }}
          >
            Recommendation Hub
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary, #9ca3af)', fontSize: 'var(--font-size-sm, 0.875rem)' }}>
            Goal-aligned, deterministic meal and workout recommendations powered by verified formulas with optional AI coaching insights.
          </p>
        </div>

        {/* Tab Selection */}
        <div
          role="tablist"
          aria-label="Recommendation category"
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid var(--border-subtle, #2d3748)',
            marginBottom: '1.5rem',
          }}
        >
          <button
            type="button"
            role="tab"
            id="tab-meals"
            aria-selected={activeTab === 'meals'}
            aria-controls="panel-meals"
            onClick={() => handleTabChange('meals')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'meals' ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
              color: activeTab === 'meals' ? 'var(--color-primary, #6366f1)' : 'var(--text-secondary, #9ca3af)',
              fontWeight: activeTab === 'meals' ? 600 : 400,
              cursor: 'pointer',
              fontSize: 'var(--font-size-base, 1rem)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span aria-hidden="true">🍽️</span> Meal Recommendations
          </button>
          <button
            type="button"
            role="tab"
            id="tab-workouts"
            aria-selected={activeTab === 'workouts'}
            aria-controls="panel-workouts"
            onClick={() => handleTabChange('workouts')}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'workouts' ? '2px solid var(--color-primary, #6366f1)' : '2px solid transparent',
              color: activeTab === 'workouts' ? 'var(--color-primary, #6366f1)' : 'var(--text-secondary, #9ca3af)',
              fontWeight: activeTab === 'workouts' ? 600 : 400,
              cursor: 'pointer',
              fontSize: 'var(--font-size-base, 1rem)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span aria-hidden="true">🏋️</span> Workout Recommendations
          </button>
        </div>

        {/* ========================================================================= */}
        {/* MEALS TAB PANEL */}
        {/* ========================================================================= */}
        {activeTab === 'meals' && (
          <section id="panel-meals" role="tabpanel" aria-labelledby="tab-meals">
            {/* Controls Form */}
            <form
              noValidate
              onSubmit={handleMealSubmit}
              style={{
                background: 'var(--bg-surface, #111827)',
                border: '1px solid var(--border-subtle, #2d3748)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor="meal-type-select"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Meal Type
                  </label>
                  <select
                    id="meal-type-select"
                    className="form-input"
                    value={mealType}
                    onChange={(e) => setMealType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {VALID_MEAL_TYPES.map((type) => (
                      <option key={type} value={type} style={{ textTransform: 'capitalize' }}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="meal-target-calories"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Target Calories (Optional Override)
                  </label>
                  <input
                    type="number"
                    id="meal-target-calories"
                    className="form-input"
                    placeholder="e.g. 600 (100–2500)"
                    min={100}
                    max={2500}
                    value={targetCalories}
                    onChange={(e) => setTargetCalories(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meal-limit-select"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Max Results
                  </label>
                  <select
                    id="meal-limit-select"
                    className="form-input"
                    value={mealLimit}
                    onChange={(e) => setMealLimit(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  >
                    <option value={5}>5 recommendations</option>
                    <option value={10}>10 recommendations</option>
                    <option value={15}>15 recommendations</option>
                    <option value={20}>20 recommendations</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor="meal-allergies-input"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Allergies (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="meal-allergies-input"
                    className="form-input"
                    placeholder="e.g. peanuts, dairy, shellfish"
                    value={allergiesInput}
                    onChange={(e) => setAllergiesInput(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meal-disliked-input"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Disliked Foods (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="meal-disliked-input"
                    className="form-input"
                    placeholder="e.g. broccoli, mushrooms"
                    value={dislikedFoodsInput}
                    onChange={(e) => setDislikedFoodsInput(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-subtle, #2d3748)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="meal-ai-checkbox"
                    checked={mealIncludeAi}
                    onChange={(e) => setMealIncludeAi(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="meal-ai-checkbox"
                    style={{ fontSize: 'var(--font-size-sm, 0.875rem)', cursor: 'pointer', color: 'var(--text-secondary, #9ca3af)' }}
                  >
                    Include AI explanation and ranking
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!mealIncludeAi && mealData && !mealData.ai_used && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleMealAiEnrichClick}
                      disabled={mealLoading}
                      style={{ fontSize: 'var(--font-size-sm, 0.875rem)' }}
                    >
                      ✨ Add AI explanations
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={mealLoading}
                    style={{ fontSize: 'var(--font-size-sm, 0.875rem)' }}
                  >
                    {mealLoading ? 'Generating...' : 'Get Meal Recommendations'}
                  </button>
                </div>
              </div>
            </form>

            {/* Error State */}
            {mealError && (
              <div
                role="alert"
                style={{
                  background: 'var(--color-error-bg, rgba(239, 68, 68, 0.15))',
                  border: '1px solid var(--color-error, #ef4444)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ color: 'var(--color-error, #ef4444)', fontSize: 'var(--font-size-sm, 0.875rem)' }}>
                  <strong>Error loading recommendations:</strong> {mealError}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void fetchMealRecommendations()}
                  style={{ fontSize: 'var(--font-size-xs, 0.75rem)' }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State */}
            {mealLoading && (
              <div
                role="status"
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-secondary, #9ca3af)',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                }}
              >
                <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                  ⏳
                </div>
                Generating goal-aligned meal recommendations...
              </div>
            )}

            {/* Results Content */}
            {!mealLoading && mealData && (
              <div>
                {/* Target context banner */}
                {(mealData.target_calories !== null || mealData.remaining_daily_calories !== null) && (
                  <div
                    style={{
                      background: 'var(--bg-surface, #111827)',
                      border: '1px solid var(--border-subtle, #2d3748)',
                      borderRadius: 'var(--radius-md, 8px)',
                      padding: '0.75rem 1rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      gap: '1.5rem',
                      flexWrap: 'wrap',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      color: 'var(--text-secondary, #9ca3af)',
                    }}
                  >
                    {mealData.target_calories !== null && (
                      <div>
                        Target Meal Calories:{' '}
                        <strong style={{ color: 'var(--text-primary, #f9fafb)' }}>
                          {mealData.target_calories} kcal
                        </strong>
                      </div>
                    )}
                    {mealData.target_protein_g !== null && (
                      <div>
                        Target Protein:{' '}
                        <strong style={{ color: '#38bdf8' }}>{mealData.target_protein_g} g</strong>
                      </div>
                    )}
                    {mealData.remaining_daily_calories !== null && (
                      <div>
                        Remaining Daily Budget:{' '}
                        <strong style={{ color: 'var(--color-primary, #6366f1)' }}>
                          {mealData.remaining_daily_calories} kcal
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Explanation Panel */}
                <AIExplanationPanel
                  aiUsed={mealData.ai_used}
                  aiFallback={mealData.ai_fallback}
                  aiSummary={mealData.ai_summary}
                  aiConsiderations={mealData.ai_considerations}
                  aiDisclaimer={mealData.metadata?.ai_disclaimer as string | undefined}
                />

                {/* Empty State */}
                {mealData.items.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem 1rem',
                      background: 'var(--bg-surface, #111827)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      border: '1px solid var(--border-subtle, #2d3748)',
                    }}
                  >
                    <p style={{ color: 'var(--text-secondary, #9ca3af)', marginBottom: '1rem' }}>
                      No meal recommendations matched your criteria or remaining calorie budget.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setTargetCalories('');
                        setAllergiesInput('');
                        setDislikedFoodsInput('');
                        void fetchMealRecommendations();
                      }}
                    >
                      Reset Filters &amp; Retry
                    </button>
                  </div>
                ) : (
                  <div>
                    {mealData.items.map((item, idx) => (
                      <MealRecommendationCard key={item.id} item={item} rankIndex={idx + 1} />
                    ))}
                  </div>
                )}

                {/* Backend Disclaimer */}
                {mealData.disclaimer && (
                  <div
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle, #2d3748)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      color: 'var(--text-muted, #6b7280)',
                      fontStyle: 'italic',
                    }}
                  >
                    {mealData.disclaimer}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* WORKOUTS TAB PANEL */}
        {/* ========================================================================= */}
        {activeTab === 'workouts' && (
          <section id="panel-workouts" role="tabpanel" aria-labelledby="tab-workouts">
            {/* Workout Controls Form */}
            <form
              noValidate
              onSubmit={handleWorkoutSubmit}
              style={{
                background: 'var(--bg-surface, #111827)',
                border: '1px solid var(--border-subtle, #2d3748)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label
                    htmlFor="workout-duration-input"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Target Duration (15–120 min)
                  </label>
                  <input
                    type="number"
                    id="workout-duration-input"
                    className="form-input"
                    min={15}
                    max={120}
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="workout-type-select"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Workout Type
                  </label>
                  <select
                    id="workout-type-select"
                    className="form-input"
                    value={workoutType}
                    onChange={(e) => setWorkoutType(e.target.value as RecommendationWorkoutType | '')}
                    style={{ width: '100%' }}
                  >
                    <option value="">Any Type (Auto Goal-Aligned)</option>
                    {VALID_WORKOUT_TYPES.map((type: RecommendationWorkoutType) => (
                      <option key={type} value={type}>
                        {WORKOUT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="workout-limit-select"
                    style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                  >
                    Max Results
                  </label>
                  <select
                    id="workout-limit-select"
                    className="form-input"
                    value={workoutLimit}
                    onChange={(e) => setWorkoutLimit(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  >
                    <option value={3}>3 recommendations</option>
                    <option value={5}>5 recommendations</option>
                    <option value={8}>8 recommendations</option>
                    <option value={10}>10 recommendations</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="workout-equipment-input"
                  style={{ display: 'block', fontWeight: 500, fontSize: 'var(--font-size-sm, 0.875rem)', marginBottom: '0.25rem' }}
                >
                  Available Equipment (comma-separated, leave blank for unconstrained)
                </label>
                <input
                  type="text"
                  id="workout-equipment-input"
                  className="form-input"
                  placeholder="e.g. barbell, dumbbell, cable (blank = full gym access)"
                  value={equipmentInput}
                  onChange={(e) => setEquipmentInput(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Action buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid var(--border-subtle, #2d3748)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="workout-ai-checkbox"
                    checked={workoutIncludeAi}
                    onChange={(e) => setWorkoutIncludeAi(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="workout-ai-checkbox"
                    style={{ fontSize: 'var(--font-size-sm, 0.875rem)', cursor: 'pointer', color: 'var(--text-secondary, #9ca3af)' }}
                  >
                    Include AI explanation and ranking
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!workoutIncludeAi && workoutData && !workoutData.ai_used && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleWorkoutAiEnrichClick}
                      disabled={workoutLoading}
                      style={{ fontSize: 'var(--font-size-sm, 0.875rem)' }}
                    >
                      ✨ Add AI explanations
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={workoutLoading}
                    style={{ fontSize: 'var(--font-size-sm, 0.875rem)' }}
                  >
                    {workoutLoading ? 'Generating...' : 'Get Workout Recommendations'}
                  </button>
                </div>
              </div>
            </form>

            {/* Error State */}
            {workoutError && (
              <div
                role="alert"
                style={{
                  background: 'var(--color-error-bg, rgba(239, 68, 68, 0.15))',
                  border: '1px solid var(--color-error, #ef4444)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ color: 'var(--color-error, #ef4444)', fontSize: 'var(--font-size-sm, 0.875rem)' }}>
                  <strong>Error loading recommendations:</strong> {workoutError}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void fetchWorkoutRecommendations()}
                  style={{ fontSize: 'var(--font-size-xs, 0.75rem)' }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading State */}
            {workoutLoading && (
              <div
                role="status"
                style={{
                  textAlign: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-secondary, #9ca3af)',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                }}
              >
                <div aria-hidden="true" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                  ⏳
                </div>
                Generating goal-aligned workout recommendations...
              </div>
            )}

            {/* Results Content */}
            {!workoutLoading && workoutData && (
              <div>
                {/* Target context banner */}
                <div
                  style={{
                    background: 'var(--bg-surface, #111827)',
                    border: '1px solid var(--border-subtle, #2d3748)',
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    fontSize: 'var(--font-size-xs, 0.75rem)',
                    color: 'var(--text-secondary, #9ca3af)',
                  }}
                >
                  <div>
                    Target Session Duration:{' '}
                    <strong style={{ color: 'var(--text-primary, #f9fafb)' }}>
                      ⏱ {workoutData.target_duration_minutes} min
                    </strong>
                  </div>
                  {workoutData.workout_type && (
                    <div>
                      Program Type Focus:{' '}
                      <strong style={{ color: 'var(--color-primary, #6366f1)', textTransform: 'capitalize' }}>
                        {workoutData.workout_type}
                      </strong>
                    </div>
                  )}
                  <div>
                    Programs Evaluated:{' '}
                    <strong style={{ color: 'var(--text-primary, #f9fafb)' }}>
                      {workoutData.total_generated} generated · {workoutData.total_survived_filtering} filtered
                    </strong>
                  </div>
                </div>

                {/* AI Explanation Panel */}
                <AIExplanationPanel
                  aiUsed={workoutData.ai_used}
                  aiFallback={workoutData.ai_fallback}
                  aiSummary={workoutData.ai_summary}
                  aiConsiderations={workoutData.ai_considerations}
                  aiDisclaimer={workoutData.metadata?.ai_disclaimer as string | undefined}
                />

                {/* Empty State */}
                {workoutData.items.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '3rem 1rem',
                      background: 'var(--bg-surface, #111827)',
                      borderRadius: 'var(--radius-lg, 12px)',
                      border: '1px solid var(--border-subtle, #2d3748)',
                    }}
                  >
                    <p style={{ color: 'var(--text-secondary, #9ca3af)', marginBottom: '1rem' }}>
                      No workout recommendations matched your duration and equipment criteria.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setTargetDuration('45');
                        setWorkoutType('');
                        setEquipmentInput('');
                        void fetchWorkoutRecommendations();
                      }}
                    >
                      Reset Filters &amp; Retry
                    </button>
                  </div>
                ) : (
                  <div>
                    {workoutData.items.map((item, idx) => (
                      <WorkoutRecommendationCard key={item.id} item={item} rankIndex={idx + 1} />
                    ))}
                  </div>
                )}

                {/* Backend Disclaimer */}
                {workoutData.disclaimer && (
                  <div
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.75rem 1rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle, #2d3748)',
                      borderRadius: 'var(--radius-md, 8px)',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      color: 'var(--text-muted, #6b7280)',
                      fontStyle: 'italic',
                    }}
                  >
                    {workoutData.disclaimer}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
  );
};
