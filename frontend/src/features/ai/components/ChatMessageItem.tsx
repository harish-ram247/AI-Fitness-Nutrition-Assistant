import React, { useState } from 'react';
import type { ChatSourceRead } from '../../../types/ai';
import { formatDateTime } from '../../../utils/date';

export interface ChatMessageItemProps {
  id: string;
  role: 'user' | 'assistant' | string;
  content: string;
  createdAt: string;
  sources?: ChatSourceRead[];
  userDataUsed?: string[];
  tokensUsed?: number;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  role,
  content,
  createdAt,
  sources = [],
  userDataUsed = [],
  tokensUsed,
}) => {
  const isUser = role === 'user';
  const [sourcesOpen, setSourcesOpen] = useState(false);

  return (
    <article
      aria-label={`${isUser ? 'User' : 'Assistant'} message`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1.25rem',
        maxWidth: '100%',
      }}
    >
      {/* Header with Sender and Timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.25rem',
          fontSize: 'var(--font-size-xs, 0.75rem)',
          color: 'var(--text-muted, #9ca3af)',
          padding: '0 0.5rem',
        }}
      >
        <span style={{ fontWeight: 600, color: isUser ? 'var(--color-primary, #60a5fa)' : '#a78bfa' }}>
          {isUser ? 'You' : 'AI Assistant'}
        </span>
        <span>•</span>
        <time dateTime={createdAt}>{formatDateTime(createdAt)}</time>
      </div>

      {/* Bubble Container */}
      <div
        style={{
          maxWidth: '85%',
          backgroundColor: isUser
            ? 'var(--color-primary, #2563eb)'
            : 'var(--bg-surface, #1e293b)',
          color: isUser ? '#ffffff' : 'var(--text-primary, #f9fafb)',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          border: isUser ? '1px solid #1d4ed8' : '1px solid var(--border-subtle, #334155)',
          padding: '0.875rem 1.125rem',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
          wordBreak: 'break-word',
          lineHeight: 1.55,
          fontSize: 'var(--font-size-sm, 0.9375rem)',
        }}
      >
        {/* Content Body (Safe Text Rendering with preserved whitespace) */}
        <div style={{ whiteSpace: 'pre-wrap' }}>{content}</div>

        {/* User Data Context Badge (Assistant only) */}
        {!isUser && userDataUsed && userDataUsed.length > 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: 'var(--font-size-xs, 0.75rem)',
              color: 'var(--text-secondary, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontWeight: 500 }}>Personal context used:</span>
            {userDataUsed.map((dataKey, idx) => (
              <span
                key={idx}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                }}
              >
                {dataKey.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Source Citations (Assistant only) */}
        {!isUser && sources && sources.length > 0 && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <button
              type="button"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              aria-expanded={sourcesOpen}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0.2rem 0',
                color: '#38bdf8',
                fontSize: 'var(--font-size-xs, 0.75rem)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 500,
              }}
            >
              <span>📚</span>
              <span>
                {sources.length} {sources.length === 1 ? 'Source Citation' : 'Source Citations'}
              </span>
              <span>{sourcesOpen ? '▲' : '▼'}</span>
            </button>

            {sourcesOpen && (
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }}
              >
                {sources.map((source, idx) => (
                  <div
                    key={source.chunk_id || idx}
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 'var(--radius-sm, 6px)',
                      padding: '0.5rem 0.75rem',
                      fontSize: 'var(--font-size-xs, 0.75rem)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        marginBottom: '0.2rem',
                      }}
                    >
                      <strong style={{ color: '#f1f5f9' }}>
                        {idx + 1}. {source.document_title}
                      </strong>
                      <span
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        Relevance: {Math.round(source.similarity_score * 100)}%
                      </span>
                    </div>

                    {source.section_title && (
                      <div style={{ color: '#94a3b8' }}>
                        Section: {source.section_title}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tokens used indicator (Subtle assistant metadata) */}
        {!isUser && tokensUsed !== undefined && tokensUsed > 0 && (
          <div
            style={{
              marginTop: '0.4rem',
              textAlign: 'right',
              fontSize: '0.6875rem',
              color: 'var(--text-muted, #64748b)',
            }}
          >
            {tokensUsed} tokens
          </div>
        )}
      </div>
    </article>
  );
};
