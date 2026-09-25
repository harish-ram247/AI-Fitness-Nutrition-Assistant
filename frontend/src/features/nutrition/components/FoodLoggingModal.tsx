import React, { useState, useEffect } from 'react';
import { nutritionApi } from '../nutritionApi';
import { ApiError } from '../../../api/errors';
import { MEAL_TYPE_LABELS, VALID_MEAL_TYPES, type FoodEntryCreate } from '../../../types/nutrition';
import type { FoodItemRead, FoodItemServingRead } from '../../../types/food';

interface FoodLoggingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMealType?: string;
  targetDate: string;
  onEntryLogged: () => void;
}

export const FoodLoggingModal: React.FC<FoodLoggingModalProps> = ({
  isOpen,
  onClose,
  defaultMealType = 'breakfast',
  targetDate,
  onEntryLogged,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<FoodItemRead[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Selected food item & details
  const [selectedFood, setSelectedFood] = useState<FoodItemRead | null>(null);
  const [isLoadingFoodDetails, setIsLoadingFoodDetails] = useState<boolean>(false);

  // Form State
  const [loggingMode, setLoggingMode] = useState<'quantity' | 'serving'>('quantity');
  const [quantityGrams, setQuantityGrams] = useState<string>('100');
  const [selectedServingId, setSelectedServingId] = useState<string>('');
  const [servingCount, setServingCount] = useState<string>('1');
  const [mealType, setMealType] = useState<string>(defaultMealType);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setMealType(defaultMealType);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedFood(null);
      setLoggingMode('quantity');
      setQuantityGrams('100');
      setSelectedServingId('');
      setServingCount('1');
      setIsSubmitting(false);
      setError(null);
      setFieldErrors({});
      setHasSearched(false);
    }
  }, [isOpen, defaultMealType]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    try {
      const res = await nutritionApi.searchFoods({ q: searchQuery.trim(), size: 20 });
      setSearchResults(res.items);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to search food catalog.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectFood = async (item: FoodItemRead) => {
    setIsLoadingFoodDetails(true);
    setError(null);
    try {
      // Fetch full details including servings
      const detailed = await nutritionApi.getFood(item.id);
      setSelectedFood(detailed);

      // Default to default serving if available, else quantity
      if (detailed.servings && detailed.servings.length > 0) {
        const defaultSrv = detailed.servings.find((s) => s.is_default) || detailed.servings[0];
        setSelectedServingId(defaultSrv.id);
        setServingCount('1');
        setLoggingMode('serving');
      } else {
        setLoggingMode('quantity');
        setQuantityGrams('100');
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load food details.');
      }
    } finally {
      setIsLoadingFoodDetails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFood || isSubmitting) return;

    setError(null);
    setFieldErrors({});

    // Client-side validations for mutually exclusive logging modes
    const errors: Record<string, string> = {};

    if (loggingMode === 'quantity') {
      const q = parseFloat(quantityGrams);
      if (isNaN(q) || q <= 0) {
        errors.quantity_g = 'Quantity must be strictly greater than 0.';
      }
    } else {
      if (!selectedServingId) {
        errors.serving_id = 'Please select a serving size.';
      }
      const cnt = parseFloat(servingCount);
      if (isNaN(cnt) || cnt <= 0) {
        errors.serving_count = 'Serving count must be strictly greater than 0.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Build timezone-aware ISO string for target date
    const now = new Date();
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
    const timezoneOffsetISO = dateObj.toISOString();

    const payload: FoodEntryCreate = {
      food_item_id: selectedFood.id,
      meal_type: mealType,
      logged_at: timezoneOffsetISO,
    };

    if (loggingMode === 'quantity') {
      payload.quantity_g = parseFloat(quantityGrams);
    } else {
      payload.serving_id = selectedServingId;
      payload.serving_count = parseFloat(servingCount);
    }

    setIsSubmitting(true);
    try {
      await nutritionApi.createFoodEntry(payload);
      onEntryLogged();
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.validationErrors && err.validationErrors.length > 0) {
          const serverErrors: Record<string, string> = {};
          err.validationErrors.forEach((ve) => {
            const field = String(ve.loc[ve.loc.length - 1]);
            serverErrors[field] = ve.msg;
          });
          setFieldErrors(serverErrors);
        }
      } else {
        setError('Failed to log food entry. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-food-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-4)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 id="log-food-modal-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {selectedFood ? `Log: ${selectedFood.name}` : 'Log Food to Diary'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: 'var(--spacing-1)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 'var(--spacing-6)', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              role="alert"
              style={{
                backgroundColor: 'var(--color-error-bg)',
                border: '1px solid var(--color-error)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--spacing-3)',
                marginBottom: 'var(--spacing-4)',
                color: 'var(--color-error)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              {error}
            </div>
          )}

          {isLoadingFoodDetails ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Loading food details...
            </div>
          ) : !selectedFood ? (
            /* STEP 1: Search Catalog */
            <div>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-4)' }}>
                <input
                  type="text"
                  placeholder="Search catalog (e.g. Chicken breast, banana, oats)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isSearching}
                  aria-label="Search food catalog"
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                />
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#ffffff',
                    padding: 'var(--spacing-2) var(--spacing-4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Search Results List */}
              {isSearching ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  Searching food catalog...
                </div>
              ) : searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', maxHeight: '340px', overflowY: 'auto' }}>
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFood(item)}
                      style={{
                        padding: 'var(--spacing-3) var(--spacing-4)',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'border-color var(--transition-fast)',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--text-primary)', display: 'block' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                          {item.brand ? `${item.brand} · ` : ''}{item.source === 'usda' ? 'USDA Verified' : 'Custom'}
                        </span>
                      </div>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>
                        {Math.round(item.calories_per_100g)} kcal / 100g
                      </span>
                    </div>
                  ))}
                </div>
              ) : hasSearched ? (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  No matching foods found in catalog. Try another search term.
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 'var(--spacing-8)', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  Type a food name above to search USDA Foundation and custom foods.
                </div>
              )}
            </div>
          ) : (
            /* STEP 2: Configure Serving / Quantity & Meal Type */
            <form onSubmit={handleSubmit} noValidate>
              <div
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-3) var(--spacing-4)',
                  marginBottom: 'var(--spacing-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', display: 'block' }}>
                    Selected Food Item
                  </span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedFood.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFood(null)}
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
                  Change Food
                </button>
              </div>

              {/* Meal Type Selection */}
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <label
                  htmlFor="meal_type_select"
                  style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
                >
                  Meal
                </label>
                <select
                  id="meal_type_select"
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    boxSizing: 'border-box',
                  }}
                >
                  {VALID_MEAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEAL_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mutually Exclusive Logging Mode Selector */}
              <div style={{ marginBottom: 'var(--spacing-4)' }}>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-2)', color: 'var(--text-primary)' }}>
                  Measurement Mode
                </label>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <button
                    type="button"
                    onClick={() => setLoggingMode('quantity')}
                    style={{
                      flex: 1,
                      padding: 'var(--spacing-2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: `1px solid ${loggingMode === 'quantity' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: loggingMode === 'quantity' ? 'var(--color-primary)' : 'var(--bg-primary)',
                      color: loggingMode === 'quantity' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    Custom Quantity (g)
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoggingMode('serving')}
                    disabled={!selectedFood.servings || selectedFood.servings.length === 0}
                    style={{
                      flex: 1,
                      padding: 'var(--spacing-2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 500,
                      cursor: selectedFood.servings && selectedFood.servings.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedFood.servings && selectedFood.servings.length > 0 ? 1 : 0.5,
                      border: `1px solid ${loggingMode === 'serving' ? 'var(--color-primary)' : 'var(--border-subtle)'}`,
                      backgroundColor: loggingMode === 'serving' ? 'var(--color-primary)' : 'var(--bg-primary)',
                      color: loggingMode === 'serving' ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    Predefined Serving ({selectedFood.servings?.length || 0})
                  </button>
                </div>
              </div>

              {/* Mode A: Quantity in Grams */}
              {loggingMode === 'quantity' ? (
                <div style={{ marginBottom: 'var(--spacing-5)' }}>
                  <label
                    htmlFor="quantity_grams"
                    style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
                  >
                    Quantity (grams) <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    id="quantity_grams"
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder="e.g. 150"
                    value={quantityGrams}
                    onChange={(e) => setQuantityGrams(e.target.value)}
                    disabled={isSubmitting}
                    aria-invalid={Boolean(fieldErrors.quantity_g)}
                    style={{
                      width: '100%',
                      padding: 'var(--spacing-2) var(--spacing-3)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-primary)',
                      border: `1px solid ${fieldErrors.quantity_g ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                      color: 'var(--text-primary)',
                      fontSize: 'var(--font-size-sm)',
                      boxSizing: 'border-box',
                    }}
                  />
                  {fieldErrors.quantity_g && (
                    <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                      {fieldErrors.quantity_g}
                    </span>
                  )}
                </div>
              ) : (
                /* Mode B: Serving Selection + Count */
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-5)' }}>
                  <div>
                    <label
                      htmlFor="serving_id_select"
                      style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
                    >
                      Serving Size
                    </label>
                    <select
                      id="serving_id_select"
                      value={selectedServingId}
                      onChange={(e) => setSelectedServingId(e.target.value)}
                      disabled={isSubmitting}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-size-sm)',
                        boxSizing: 'border-box',
                      }}
                    >
                      {selectedFood.servings?.map((s: FoodItemServingRead) => (
                        <option key={s.id} value={s.id}>
                          {s.description} ({s.grams}g)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="serving_count"
                      style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 500, marginBottom: 'var(--spacing-1)', color: 'var(--text-primary)' }}
                    >
                      Number of Servings
                    </label>
                    <input
                      id="serving_count"
                      type="number"
                      step="0.25"
                      min="0.1"
                      placeholder="e.g. 1.5"
                      value={servingCount}
                      onChange={(e) => setServingCount(e.target.value)}
                      disabled={isSubmitting}
                      aria-invalid={Boolean(fieldErrors.serving_count)}
                      style={{
                        width: '100%',
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-primary)',
                        border: `1px solid ${fieldErrors.serving_count ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                        color: 'var(--text-primary)',
                        fontSize: 'var(--font-size-sm)',
                        boxSizing: 'border-box',
                      }}
                    />
                    {fieldErrors.serving_count && (
                      <span style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-xs)', marginTop: 'var(--spacing-1)', display: 'block' }}>
                        {fieldErrors.serving_count}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: 'var(--spacing-2) var(--spacing-4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    border: 'none',
                    color: '#ffffff',
                    padding: 'var(--spacing-2) var(--spacing-5)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Logging...' : 'Add to Diary'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
