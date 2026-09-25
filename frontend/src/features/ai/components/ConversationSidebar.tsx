import React from 'react';
import type { ConversationSummaryRead } from '../../../types/ai';
import { formatDate } from '../../../utils/date';

interface ConversationSidebarProps {
  conversations: ConversationSummaryRead[];
  activeConversationId: string | null;
  loading: boolean;
  error: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRequestDelete: (id: string, title: string) => void;
  onRetry: () => void;
  onOpenDailySummary: () => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  loading,
  error,
  onSelectConversation,
  onNewChat,
  onRequestDelete,
  onRetry,
  onOpenDailySummary,
}) => {
  return (
    <aside
      aria-label="AI Conversations"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: 'var(--bg-surface, #111827)',
        borderRight: '1px solid var(--border-subtle, #1f2937)',
        width: '100%',
      }}
    >
      {/* Top Actions: New Chat & Daily Summary */}
      <div
        style={{
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          borderBottom: '1px solid var(--border-subtle, #1f2937)',
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={onNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            fontWeight: 600,
          }}
        >
          <span>＋</span> New Chat
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onOpenDailySummary}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            width: '100%',
            fontSize: 'var(--font-size-xs, 0.75rem)',
          }}
        >
          <span>🥗</span> Today&apos;s Nutrition Summary
        </button>
      </div>

      {/* Conversations List Header */}
      <div
        style={{
          padding: '0.75rem 1rem 0.25rem',
          fontSize: 'var(--font-size-xs, 0.75rem)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted, #6b7280)',
        }}
      >
        Recent Conversations
      </div>

      {/* List / Loading / Error / Empty States */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {loading && conversations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary, #9ca3af)' }}>
            <div
              style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: 'var(--color-primary, #3b82f6)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginBottom: '0.5rem',
              }}
            />
            <p style={{ margin: 0, fontSize: 'var(--font-size-xs, 0.75rem)' }}>Loading conversations...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '0.75rem', textAlign: 'center' }}>
            <p
              role="alert"
              style={{
                color: 'var(--color-danger, #ef4444)',
                fontSize: 'var(--font-size-xs, 0.75rem)',
                marginBottom: '0.5rem',
              }}
            >
              {error}
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onRetry}
              style={{ fontSize: 'var(--font-size-xs, 0.75rem)', padding: '0.25rem 0.5rem' }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--text-secondary, #9ca3af)',
              fontSize: 'var(--font-size-xs, 0.8125rem)',
              lineHeight: 1.5,
            }}
          >
            Start a conversation with your AI fitness assistant.
          </div>
        )}

        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <li
                key={conv.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-md, 8px)',
                  marginBottom: '0.25rem',
                  backgroundColor: isActive
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'transparent',
                  border: isActive
                    ? '1px solid var(--color-primary, #3b82f6)'
                    : '1px solid transparent',
                  transition: 'background-color 0.15s ease',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(conv.id)}
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '0.625rem 0.75rem',
                    cursor: 'pointer',
                    color: isActive ? '#60a5fa' : 'var(--text-primary, #f9fafb)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {conv.title || 'Untitled Conversation'}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                      color: 'var(--text-muted, #6b7280)',
                      marginTop: '0.15rem',
                    }}
                  >
                    {formatDate(conv.updated_at || conv.created_at)}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestDelete(conv.id, conv.title || 'Untitled Conversation');
                  }}
                  aria-label={`Delete conversation ${conv.title || conv.id}`}
                  title="Delete Conversation"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #6b7280)',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
};
