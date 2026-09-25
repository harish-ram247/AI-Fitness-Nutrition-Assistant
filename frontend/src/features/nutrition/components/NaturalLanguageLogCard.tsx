import React, { useState } from 'react';
import { nutritionApi } from '../nutritionApi';
import { ApiError } from '../../../api/errors';
import { MEAL_TYPE_LABELS, VALID_MEAL_TYPES, type NaturalLanguageLogPreview } from '../../../types/nutrition';

interface NaturalLanguageLogCardProps {
  targetDate: string;
  onEntriesConfirmed: () => void;
}

export const NaturalLanguageLogCard: React.FC<NaturalLanguageLogCardProps> = ({
  targetDate,
  onEntriesConfirmed,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [mealType, setMealType] = useState<string>('lunch');

  // Preview State
  const [preview, setPreview] = useState<NaturalLanguageLogPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isPreviewing) return;

    setError(null);
    setSuccessMessage(null);
    setIsPreviewing(true);

    // Build timezone-aware timestamp
    const now = new Date();
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
    const timezoneOffsetISO = dateObj.toISOString();

    try {
      const res = await nutritionApi.previewNaturalLanguage({
        text: inputText.trim(),
        meal_type: mealType,
        logged_at: timezoneOffsetISO,
      });
      setPreview(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to extract food information. Please try again.');
      }
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleConfirm = async () => {
    if (!preview || preview.resolved_items.length === 0 || isConfirming) return;

    setError(null);
    setIsConfirming(true);

    const now = new Date();
    const [year, month, day] = targetDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
    const timezoneOffsetISO = dateObj.toISOString();

    const confirmedItems = preview.resolved_items.map((item) => ({
      food_item_id: item.food_item_id,
      quantity_g: item.quantity_g,
      meal_type: mealType,
      logged_at: timezoneOffsetISO,
    }));

    try {
      await nutritionApi.confirmNaturalLanguage({ confirmed_items: confirmedItems });
      setSuccessMessage(`Successfully logged ${confirmedItems.length} food item${confirmedItems.length > 1 ? 's' : ''} to ${MEAL_TYPE_LABELS[mealType]}.`);
      setPreview(null);
      setInputText('');
      onEntriesConfirmed();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to confirm and log items.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setError(null);
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
      <div style={{ marginBottom: 'var(--spacing-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-1)' }}>
          <span style={{ fontSize: '1.25rem' }}>✨</span>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Natural-Language Food Logger
          </h2>
        </div>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          Type what you ate in plain English (e.g. <em>"2 scrambled eggs, two slices of whole wheat toast, and an apple"</em>). Preview calculated nutrition before confirming.
        </p>
      </div>

      {successMessage && (
        <div
          role="status"
          style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-3) var(--spacing-4)',
            marginBottom: 'var(--spacing-4)',
            color: 'var(--color-success)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          ✓ {successMessage}
        </div>
      )}

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

      {!preview ? (
        /* Input Form */
        <form onSubmit={handlePreview}>
          <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="e.g. 200g of grilled chicken breast and a cup of brown rice..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isPreviewing}
                aria-label="Describe what you ate"
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
              />
            </div>

            <div style={{ width: '140px' }}>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                disabled={isPreviewing}
                aria-label="Assign to meal"
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

            <button
              type="submit"
              disabled={isPreviewing || !inputText.trim()}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                border: 'none',
                padding: 'var(--spacing-2) var(--spacing-5)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: isPreviewing || !inputText.trim() ? 'not-allowed' : 'pointer',
                opacity: isPreviewing || !inputText.trim() ? 0.6 : 1,
              }}
            >
              {isPreviewing ? 'Extracting...' : 'Preview Nutrition'}
            </button>
          </div>
        </form>
      ) : (
        /* Preview & Confirmation State */
        <div
          data-testid="nl-preview-container"
          style={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--color-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-5)',
          }}
        >
          {/* Safety Notice Banner */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 'var(--spacing-4)',
              paddingBottom: 'var(--spacing-3)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--color-primary)',
                  letterSpacing: '0.05em',
                  display: 'block',
                }}
              >
                PREVIEW ONLY — Not yet committed
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                Review recognized items and server calculations before adding to diary.
              </span>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Target Meal:</span>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                disabled={isConfirming}
                aria-label="Assign to meal"
                style={{
                  padding: '2px var(--spacing-2)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                }}
              >
                {VALID_MEAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MEAL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resolved Food Items */}
          {preview.resolved_items.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)', display: 'block' }}>
                Recognized Items ({preview.resolved_items.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {preview.resolved_items.map((item, idx) => (
                  <div
                    key={item.food_item_id || idx}
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--spacing-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--spacing-2)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                        {item.food_name}
                      </span>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                        Extracted: "{item.extracted_text}" · {item.quantity_g}g
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)', display: 'block' }}>
                        {Math.round(item.calories)} kcal
                      </strong>
                      <span>P: {item.protein_g}g · C: {item.carbs_g}g · F: {item.fat_g}g</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unresolved Food Items (if any) */}
          {preview.unresolved && preview.unresolved.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-4)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-warning)', textTransform: 'uppercase', marginBottom: 'var(--spacing-2)', display: 'block' }}>
                ⚠️ Unresolved Items ({preview.unresolved.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                {preview.unresolved.map((unres, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: 'rgba(234, 179, 8, 0.08)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--spacing-3)',
                      fontSize: 'var(--font-size-xs)',
                    }}
                  >
                    <strong style={{ color: 'var(--color-warning)' }}>{unres.recognized_name}</strong>: {unres.suggested_action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Totals Summary */}
          <div
            style={{
              padding: 'var(--spacing-3) 0',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--spacing-4)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Total Preview:
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-primary)' }}>
              {Math.round(preview.total_calories)} kcal · P: {preview.total_protein_g}g · C: {preview.total_carbs_g}g · F: {preview.total_fat_g}g
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
            <button
              type="button"
              onClick={handleCancelPreview}
              disabled={isConfirming}
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
              Cancel Preview
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirming || preview.resolved_items.length === 0}
              style={{
                backgroundColor: 'var(--color-primary)',
                border: 'none',
                color: '#ffffff',
                padding: 'var(--spacing-2) var(--spacing-5)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 600,
                cursor: isConfirming || preview.resolved_items.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isConfirming || preview.resolved_items.length === 0 ? 0.6 : 1,
              }}
            >
              {isConfirming ? 'Adding...' : 'Confirm & Log to Diary'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
