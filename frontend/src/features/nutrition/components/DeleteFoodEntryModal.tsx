import React, { useEffect } from 'react';
import type { FoodEntryRead } from '../../../types/nutrition';

interface DeleteFoodEntryModalProps {
  isOpen: boolean;
  entry: FoodEntryRead | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
  error: string | null;
}

export const DeleteFoodEntryModal: React.FC<DeleteFoodEntryModalProps> = ({
  isOpen,
  entry,
  onClose,
  onConfirm,
  isDeleting,
  error,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !entry) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-food-modal-title"
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
          maxWidth: '440px',
          padding: 'var(--spacing-6)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="delete-food-modal-title" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 var(--spacing-3) 0' }}>
          Delete Food Entry
        </h2>

        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--spacing-4) 0' }}>
          Are you sure you want to delete{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            "{entry.food_name_snapshot}" ({entry.quantity_g}g)
          </strong>{' '}
          from your diary?
        </p>

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-3)' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
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
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              backgroundColor: 'var(--color-error)',
              border: 'none',
              color: '#ffffff',
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};
