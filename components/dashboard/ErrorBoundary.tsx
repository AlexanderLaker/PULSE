/**
 * Keeps one failing pane from blanking the dashboard: a render error shows a
 * short message and a retry button instead. In development the error and its
 * component stack are shown as well.
 */

import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { S, BODY_FONT, MONO_FONT } from '@/lib/theme';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

const CONTAINER: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: S.surface,
  fontFamily: BODY_FONT,
  padding: 24,
};

const CONTENT: CSSProperties = {
  maxWidth: 480,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
  alignItems: 'center',
};

const ICON_BOX: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: S.errorContainer,
};

const HEADING: CSSProperties = {
  fontSize: 24,
  fontWeight: 600,
  color: S.onBg,
  margin: 0,
};

const DESCRIPTION: CSSProperties = {
  fontSize: 15,
  color: S.mutedText,
  margin: 0,
  lineHeight: 1.6,
};

const DETAILS_BOX: CSSProperties = {
  width: '100%',
  padding: 12,
  backgroundColor: S.surfaceLow,
  borderRadius: 8,
  border: `1px solid ${S.cardBorder}`,
  textAlign: 'left',
};

const ERROR_MESSAGE: CSSProperties = {
  fontSize: 12,
  fontFamily: MONO_FONT,
  color: S.contraction,
  margin: '0 0 8px 0',
  wordBreak: 'break-word',
};

const STACK: CSSProperties = {
  fontSize: 10,
  overflow: 'auto',
  color: S.mutedText,
  margin: 0,
};

const RETRY_BUTTON: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 24px',
  backgroundColor: S.primary,
  color: S.onPrimary,
  border: 'none',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  boxShadow: 'none',
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={CONTAINER}>
        <div style={CONTENT}>
          <div style={ICON_BOX}>
            <AlertTriangle size={32} color={S.contraction} />
          </div>

          <h1 style={HEADING}>Something went wrong</h1>

          <p style={DESCRIPTION}>
            The page hit an unexpected error. Try again; if it happens again, tell the PRISM team what you were doing.
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div style={DETAILS_BOX}>
              <p style={ERROR_MESSAGE}>{this.state.error.toString()}</p>
              <details style={{ fontSize: 11, color: S.mutedText }}>
                <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Stack trace</summary>
                <pre style={STACK}>{this.state.errorInfo?.componentStack}</pre>
              </details>
            </div>
          )}

          <button type="button"
            onClick={this.handleRetry}
            style={RETRY_BUTTON}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = S.primaryDim; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = S.primary; }}
          >
            <RotateCcw size={16} />
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
