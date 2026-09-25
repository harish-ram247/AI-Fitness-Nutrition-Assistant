import React from 'react';
import { MEAL_TYPE_LABELS, VALID_MEAL_TYPES, type FoodEntryRead, type MealSummary } from '../../../types/nutrition';

interface MealsListProps {
  meals: Record<string, MealSummary> | null;
  onOpenLogModal: (mealType?: string) => void;
  onOpenEditModal: (entry: FoodEntryRead) => void;
  onOpenDeleteModal: (entry: FoodEntryRead) => void;
}

export const MealsList: React.FC<MealsListProps> = ({
  meals,
  onOpenLogModal,
  onOpenEditModal,
  onOpenDeleteModal,
}) => {
  const totalEntries = meals
    ? Object.values(meals).reduce((acc, m) => acc + (m.entries ? m.entries.length : 0), 0)
    : 0;

  if (totalEntries === 0) {
    return (
      <div
        data-testid="meals-empty"
        style={{
          textAlign: 'center',
          padding: 'var(--spacing-10) var(--spacing-4)',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-subtle)',
          marginBottom: 'var(--spacing-6)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--spacing-2)' }}>🥗</div>
        <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--spacing-1) 0' }}>
          No meals logged for this day yet
        </h3>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--spacing-4) 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
          Search the food catalog, use pre-measured servings, or use our smart natural-language logger to track your meals.
        </p>
        <button
          type="button"
          onClick={() => onOpenLogModal('breakfast')}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: '#ffffff',
            border: 'none',
            padding: 'var(--spacing-2) var(--spacing-5)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Log Your First Meal
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', marginBottom: 'var(--spacing-6)' }}>
      {VALID_MEAL_TYPES.map((mealType) => {
        const mealSummary = meals?.[mealType];
        const entries = mealSummary?.entries || [];
        const mealCalories = mealSummary ? Math.round(mealSummary.calories) : 0;
        const label = MEAL_TYPE_LABELS[mealType] || mealType;

        return (
          <div
            key={mealType}
            data-testid={`meal-group-${mealType}`}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Meal Header */}
            <div
              style={{
                backgroundColor: 'var(--bg-primary)',
                padding: 'var(--spacing-3) var(--spacing-5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-3)' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {label}
                </h3>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--bg-surface-hover)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {mealCalories} kcal
                </span>
              </div>

              <button
                type="button"
                onClick={() => onOpenLogModal(mealType)}
                aria-label={`Log food to ${label}`}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 500,
                  padding: 'var(--spacing-1) var(--spacing-3)',
                  cursor: 'pointer',
                }}
              >
                + Add Food
              </button>
            </div>

            {/* Meal Items List */}
            {entries.length === 0 ? (
              <div style={{ padding: 'var(--spacing-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                No entries logged for {label.toLowerCase()}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    data-testid={`food-entry-${entry.id}`}
                    style={{
                      padding: 'var(--spacing-3) var(--spacing-5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-2)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: '200px' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>
                        {entry.food_name_snapshot}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        {entry.quantity_g} g · P: {entry.protein_g}g · C: {entry.carbs_g}g · F: {entry.fat_g}g
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {Math.round(entry.calories)} kcal
                      </span>

                      <div style={{ display: 'flex', gap: 'var(--spacing-1)' }}>
                        <button
                          type="button"
                          onClick={() => onOpenEditModal(entry)}
                          aria-label={`Edit entry ${entry.food_name_snapshot}`}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-secondary)',
                            fontSize: 'var(--font-size-xs)',
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDeleteModal(entry)}
                          aria-label={`Delete entry ${entry.food_name_snapshot}`}
                          style={{
                            background: 'var(--color-error-bg)',
                            border: '1px solid var(--color-error)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-error)',
                            fontSize: 'var(--font-size-xs)',
                            padding: '2px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
