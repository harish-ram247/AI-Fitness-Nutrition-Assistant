import React, { useState, useEffect, useCallback } from 'react';
import { nutritionApi } from './nutritionApi';
import { ApiError } from '../../api/errors';
import { getTodayDateString } from '../../utils/date';
import { DailySummaryCard } from './components/DailySummaryCard';
import { MealsList } from './components/MealsList';
import { NaturalLanguageLogCard } from './components/NaturalLanguageLogCard';
import { FoodLoggingModal } from './components/FoodLoggingModal';
import { EditFoodEntryModal } from './components/EditFoodEntryModal';
import { DeleteFoodEntryModal } from './components/DeleteFoodEntryModal';
import { NutritionHistoryView } from './components/NutritionHistoryView';
import type { DailyTotals, FoodEntryRead, MealSummary } from '../../types/nutrition';

type NutritionViewMode = 'diary' | 'history';

export const NutritionPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<NutritionViewMode>('diary');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());

  // Daily Summary & Meals State
  const [totals, setTotals] = useState<DailyTotals | null>(null);
  const [meals, setMeals] = useState<Record<string, MealSummary> | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState<boolean>(true);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Modal States
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [targetLogMealType, setTargetLogMealType] = useState<string>('breakfast');

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [entryToEdit, setEntryToEdit] = useState<FoodEntryRead | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [entryToDelete, setEntryToDelete] = useState<FoodEntryRead | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadDailySummary = useCallback(async () => {
    setIsLoadingDaily(true);
    setDailyError(null);
    try {
      const res = await nutritionApi.getDailyNutrition(selectedDate);
      setTotals(res.totals);
      setMeals(res.meals);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDailyError(err.message);
      } else {
        setDailyError('Failed to load daily nutrition data.');
      }
    } finally {
      setIsLoadingDaily(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDailySummary();
  }, [loadDailySummary]);

  const handleOpenLogModal = (mealType: string = 'breakfast') => {
    setTargetLogMealType(mealType);
    setIsLogModalOpen(true);
  };

  const handleOpenEditModal = (entry: FoodEntryRead) => {
    setEntryToEdit(entry);
    setIsEditModalOpen(true);
  };

  const handleOpenDeleteModal = (entry: FoodEntryRead) => {
    setEntryToDelete(entry);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await nutritionApi.deleteFoodEntry(entryToDelete.id);
      setIsDeleteModalOpen(false);
      setEntryToDelete(null);
      loadDailySummary();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError('Failed to delete food entry.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Page Title & View Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-3)',
          marginBottom: 'var(--spacing-5)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 var(--spacing-1) 0' }}>
            Nutrition &amp; Food Logging
          </h1>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Track daily meals, monitor macronutrient distribution, and view historical nutrition trends.
          </p>
        </div>

        {/* View Switcher and Quick Log Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              display: 'flex',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('diary')}
              style={{
                backgroundColor: viewMode === 'diary' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'diary' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--spacing-1) var(--spacing-3)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Daily Diary
            </button>
            <button
              type="button"
              onClick={() => setViewMode('history')}
              style={{
                backgroundColor: viewMode === 'history' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'history' ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding: 'var(--spacing-1) var(--spacing-3)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Nutrition History
            </button>
          </div>

          {viewMode === 'diary' && (
            <button
              type="button"
              onClick={() => handleOpenLogModal('breakfast')}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                padding: 'var(--spacing-2) var(--spacing-4)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--spacing-1)',
              }}
            >
              <span>+</span>
              <span>Log Food</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === 'diary' ? (
        /* Diary View: Daily Summary, Meals List, and Natural Language Logger */
        <>
          <DailySummaryCard
            date={selectedDate}
            totals={totals}
            isLoading={isLoadingDaily}
            error={dailyError}
            onRetry={loadDailySummary}
            onDateChange={(d) => setSelectedDate(d)}
          />

          <MealsList
            meals={meals}
            onOpenLogModal={handleOpenLogModal}
            onOpenEditModal={handleOpenEditModal}
            onOpenDeleteModal={handleOpenDeleteModal}
          />

          <NaturalLanguageLogCard
            targetDate={selectedDate}
            onEntriesConfirmed={loadDailySummary}
          />
        </>
      ) : (
        /* History View */
        <NutritionHistoryView />
      )}

      {/* Log Food Modal */}
      <FoodLoggingModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        defaultMealType={targetLogMealType}
        targetDate={selectedDate}
        onEntryLogged={loadDailySummary}
      />

      {/* Edit Food Entry Modal */}
      <EditFoodEntryModal
        isOpen={isEditModalOpen}
        entry={entryToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setEntryToEdit(null);
        }}
        onEntryUpdated={loadDailySummary}
      />

      {/* Delete Food Entry Modal */}
      <DeleteFoodEntryModal
        isOpen={isDeleteModalOpen}
        entry={entryToDelete}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setEntryToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
        error={deleteError}
      />
    </div>
  );
};
