import React, { useState, useRef, useEffect } from 'react';

interface ChatComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled: boolean;
  error: string | null;
  onRetry?: () => void;
}

const MAX_MESSAGE_LENGTH = 2000;

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSend,
  disabled,
  error,
  onRetry,
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = message.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;

  // Auto-focus input when enabled
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || disabled) return;

    const toSend = trimmed;
    try {
      await onSend(toSend);
      setMessage('');
    } catch {
      // User input is preserved on failure
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  };

  return (
    <div
      style={{
        borderTop: '1px solid var(--border-subtle, #1f2937)',
        backgroundColor: 'var(--bg-surface, #111827)',
        padding: '0.875rem 1rem',
      }}
    >
      {/* Error alert with retry */}
      {error && (
        <div
          role="alert"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--color-danger, #ef4444)',
            borderRadius: 'var(--radius-md, 8px)',
            padding: '0.625rem 0.875rem',
            color: '#fca5a5',
            fontSize: 'var(--font-size-xs, 0.75rem)',
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ position: 'relative' }}>
          <label htmlFor="ai-chat-input" className="sr-only">
            Ask the AI Assistant
          </label>
          <textarea
            id="ai-chat-input"
            ref={textareaRef}
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Ask about your nutrition, workouts, or goals... (Press Enter to send)"
            maxLength={MAX_MESSAGE_LENGTH}
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle, #374151)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '0.625rem 0.75rem',
              color: 'var(--text-primary, #f9fafb)',
              fontSize: 'var(--font-size-sm, 0.875rem)',
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: 'var(--font-size-xs, 0.75rem)',
              color: trimmed.length > 1800 ? '#f59e0b' : 'var(--text-muted, #6b7280)',
            }}
          >
            {trimmed.length}/{MAX_MESSAGE_LENGTH} chars
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!isValid || disabled}
            aria-label="Send message"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 1rem',
              fontSize: 'var(--font-size-sm, 0.875rem)',
              fontWeight: 600,
            }}
          >
            {disabled ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <span>➤</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
