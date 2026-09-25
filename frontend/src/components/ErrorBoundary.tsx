import { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Production-safe React Error Boundary.
 * Catches unexpected render crashes and displays a user-friendly fallback
 * with reload/retry capabilities without leaking stack traces or internal details.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // In production, errors can be forwarded to monitoring without logging stack traces to UI
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an unhandled render error:', error, errorInfo);
    }
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            backgroundColor: 'var(--bg-primary, #0b0f19)',
            color: 'var(--text-primary, #f9fafb)',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: 'var(--bg-surface, #111827)',
              border: '1px solid var(--border-subtle, #2d3748)',
              borderRadius: 'var(--radius-lg, 12px)',
              padding: '2rem',
              textAlign: 'center',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                fontSize: '2.5rem',
                marginBottom: '1rem',
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              ⚠️
            </div>

            <h2
              style={{
                fontSize: 'var(--font-size-xl, 1.25rem)',
                fontWeight: 700,
                color: 'var(--text-primary, #f9fafb)',
                marginBottom: '0.5rem',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                color: 'var(--text-secondary, #9ca3af)',
                fontSize: 'var(--font-size-sm, 0.875rem)',
                lineHeight: 1.5,
                marginBottom: '1.5rem',
              }}
            >
              An unexpected display error occurred while rendering this page. You can try refreshing the view to continue.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleReset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1.25rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
