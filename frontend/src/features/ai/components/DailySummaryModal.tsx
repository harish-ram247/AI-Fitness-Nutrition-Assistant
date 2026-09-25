import React, { useState, useEffect } from 'react';
import { aiApi } from '../aiApi';
import type { DailySummaryResponse } from '../../../types/ai';
import { getErrorMessage } from '../../../utils/errorHandling';

interface DailySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DailySummaryModal: React.FC<DailySummaryModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<DailySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiApi.summariseToday();
      setData(res);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to generate today's nutrition summary. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchSummary();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-summary-title"
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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle, #374151)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3
              id="daily-summary-title"
              style={{
                margin: 0,
                fontSize: 'var(--font-size-lg, 1.125rem)',
                fontWeight: 600,
                color: 'var(--text-primary, #f9fafb)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🥗</span> Daily Nutrition Narrative
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary, #9ca3af)', fontSize: 'var(--font-size-xs, 0.75rem)' }}>
              Deterministic daily totals narrated by the AI Assistant.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: '0.25rem 0.5rem', fontSize: '1.2rem', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div
                style={{
                  display: 'inline-block',
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                  borderTopColor: 'var(--color-primary, #3b82f6)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginBottom: '1rem',
                }}
              />
              <p style={{ color: 'var(--text-secondary, #9ca3af)', margin: 0 }}>
                Synthesizing your nutrition data for today...
              </p>
            </div>
          )}

          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '1.5rem' }}>
              <div
                role="alert"
                style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--color-danger, #ef4444)',
                  borderRadius: 'var(--radius-md, 8px)',
                  color: '#fca5a5',
                  fontSize: 'var(--font-size-sm, 0.875rem)',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void fetchSummary()}
              >
                Retry Summary
              </button>
            </div>
          )}

          {data && !loading && (
            <div>
              {/* Narrative Summary */}
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle, #374151)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <h4
                  style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: 'var(--font-size-sm, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--color-primary, #60a5fa)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Summary
                </h4>
                <p
                  style={{
                    color: 'var(--text-primary, #f9fafb)',
                    fontSize: 'var(--font-size-sm, 0.875rem)',
                    lineHeight: 1.6,
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {data.summary}
                </p>
              </div>

              {/* Highlights */}
              {data.highlights && data.highlights.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <h4
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      fontWeight: 600,
                      color: 'var(--text-primary, #f9fafb)',
                    }}
                  >
                    Key Highlights
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.25rem',
                      color: 'var(--text-secondary, #9ca3af)',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      lineHeight: 1.6,
                    }}
                  >
                    {data.highlights.map((highlight, idx) => (
                      <li key={idx} style={{ marginBottom: '0.35rem' }}>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Token metadata & Disclaimer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--font-size-xs, 0.75rem)',
                  color: 'var(--text-muted, #6b7280)',
                  borderTop: '1px solid var(--border-subtle, #374151)',
                  paddingTop: '0.75rem',
                  marginTop: '1rem',
                }}
              >
                <span>Totals computed by backend. AI provides narrative review.</span>
                {data.tokens_used > 0 && (
                  <span
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                    }}
                  >
                    {data.tokens_used} tokens
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle, #374151)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
