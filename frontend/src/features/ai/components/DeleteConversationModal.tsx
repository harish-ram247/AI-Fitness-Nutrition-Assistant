import React from 'react';

interface DeleteConversationModalProps {
  isOpen: boolean;
  conversationTitle: string;
  isDeleting: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConversationModal: React.FC<DeleteConversationModalProps> = ({
  isOpen,
  conversationTitle,
  isDeleting,
  error,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-conversation-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface, #1f2937)',
          border: '1px solid var(--border-subtle, #374151)',
          borderRadius: 'var(--radius-lg, 12px)',
          maxWidth: '450px',
          width: '100%',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3
          id="delete-conversation-title"
          style={{
            margin: '0 0 0.75rem 0',
            fontSize: 'var(--font-size-lg, 1.125rem)',
            fontWeight: 600,
            color: 'var(--text-primary, #f9fafb)',
          }}
        >
          Delete Conversation
        </h3>

        <p
          style={{
            color: 'var(--text-secondary, #9ca3af)',
            fontSize: 'var(--font-size-sm, 0.875rem)',
            lineHeight: 1.5,
            marginBottom: '1.25rem',
          }}
        >
          Are you sure you want to delete &ldquo;
          <strong style={{ color: 'var(--text-primary, #f9fafb)' }}>{conversationTitle}</strong>
          &rdquo;? All messages and citations in this conversation will be permanently removed.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-danger, #ef4444)',
              borderRadius: 'var(--radius-md, 8px)',
              color: '#fca5a5',
              fontSize: 'var(--font-size-xs, 0.75rem)',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              backgroundColor: 'var(--color-danger, #ef4444)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0.5rem 1rem',
              cursor: isDeleting ? 'not-allowed' : 'pointer',
              opacity: isDeleting ? 0.7 : 1,
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
};
