import React from 'react';

interface AIExplanationPanelProps {
  aiUsed: boolean;
  aiFallback: boolean;
  aiSummary?: string | null;
  aiConsiderations?: string[];
  aiDisclaimer?: string | null;
}

export const AIExplanationPanel: React.FC<AIExplanationPanelProps> = ({
  aiUsed,
  aiFallback,
  aiSummary,
  aiConsiderations = [],
  aiDisclaimer,
}) => {
  if (!aiUsed && !aiFallback) {
    return null;
  }

  if (aiFallback) {
    return (
      <aside
        role="status"
        aria-label="AI Enrichment Status"
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.25rem', lineHeight: 1 }}>
          ℹ️
        </span>
        <div style={{ fontSize: 'var(--font-size-sm, 0.875rem)', color: 'var(--text-secondary, #9ca3af)' }}>
          <strong style={{ color: 'var(--color-warning, #f59e0b)', display: 'block', marginBottom: '0.25rem' }}>
            AI Coaching Unavailable
          </strong>
          AI explanation service is currently unavailable. Displaying verified deterministic recommendations
          generated from your targets and training history.
        </div>
      </aside>
    );
  }

  return (
    <section
      role="region"
      aria-label="AI Recommendation Analysis"
      style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.08) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.2))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3
          style={{
            margin: 0,
            fontSize: 'var(--font-size-base, 1rem)',
            fontWeight: 600,
            color: 'var(--text-primary, #f9fafb)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span aria-hidden="true">✨</span>
          AI Coaching Insights
        </h3>
        <span
          style={{
            background: 'rgba(99, 102, 241, 0.2)',
            color: 'var(--color-primary-text, #ffffff)',
            fontSize: 'var(--font-size-xs, 0.75rem)',
            fontWeight: 600,
            padding: '0.2rem 0.6rem',
            borderRadius: 'var(--radius-full, 9999px)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
          }}
        >
          AI Enriched
        </span>
      </div>

      {aiSummary && (
        <p
          style={{
            fontSize: 'var(--font-size-sm, 0.875rem)',
            color: 'var(--text-primary, #f9fafb)',
            lineHeight: 1.6,
            marginBottom: aiConsiderations.length > 0 ? '0.75rem' : 0,
          }}
        >
          {aiSummary}
        </p>
      )}

      {aiConsiderations.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <strong
            style={{
              display: 'block',
              fontSize: 'var(--font-size-xs, 0.75rem)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary, #9ca3af)',
              marginBottom: '0.5rem',
            }}
          >
            Key Considerations:
          </strong>
          <ul
            style={{
              margin: 0,
              paddingLeft: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              fontSize: 'var(--font-size-sm, 0.875rem)',
              color: 'var(--text-secondary, #9ca3af)',
            }}
          >
            {aiConsiderations.map((consideration, idx) => (
              <li key={idx}>{consideration}</li>
            ))}
          </ul>
        </div>
      )}

      {aiDisclaimer && (
        <p
          style={{
            marginTop: '0.75rem',
            marginBottom: 0,
            fontSize: 'var(--font-size-xs, 0.75rem)',
            color: 'var(--text-muted, #6b7280)',
            fontStyle: 'italic',
          }}
        >
          {aiDisclaimer}
        </p>
      )}
    </section>
  );
};
