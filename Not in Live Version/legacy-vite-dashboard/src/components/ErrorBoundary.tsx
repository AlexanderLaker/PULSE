/**
 * ErrorBoundary — Catches React errors and displays clean error UI
 * Apple-style design, light mode
 */

/// <reference types="vite/client" />
import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#FFFFFF',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 24,
      };

      const contentStyle: React.CSSProperties = {
        maxWidth: 480,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'center',
      };

      const iconContainerStyle: React.CSSProperties = {
        width: 64,
        height: 64,
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.08)',
      };

      const headingStyle: React.CSSProperties = {
        fontSize: 24,
        fontWeight: 600,
        color: '#1D1D1F',
        margin: 0,
      };

      const descriptionStyle: React.CSSProperties = {
        fontSize: 15,
        color: '#6E6E73',
        margin: 0,
        lineHeight: 1.6,
      };

      const errorDetailsStyle: React.CSSProperties = {
        width: '100%',
        padding: 12,
        backgroundColor: '#F5F5F7',
        borderRadius: 8,
        border: '1px solid rgba(0,0,0,0.08)',
        textAlign: 'left',
      };

      const errorMessageStyle: React.CSSProperties = {
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace",
        color: '#FF453A',
        margin: '0 0 8px 0',
        wordBreak: 'break-word',
      };

      const detailsStyle: React.CSSProperties = {
        fontSize: 11,
        color: '#6E6E73',
      };

      const summaryStyle: React.CSSProperties = {
        cursor: 'pointer',
        marginBottom: 8,
      };

      const stackTraceStyle: React.CSSProperties = {
        fontSize: 10,
        overflow: 'auto',
        color: '#6E6E73',
        margin: 0,
      };

      const buttonStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 24px',
        backgroundColor: '#0071E3',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: 'none',
      };

      return (
        <div style={containerStyle}>
          <div style={contentStyle}>
            {/* Error Icon */}
            <div style={iconContainerStyle}>
              <AlertTriangle size={32} color="#FF453A" />
            </div>

            {/* Heading */}
            <h1 style={headingStyle}>
              Something went wrong
            </h1>

            {/* Description */}
            <p style={descriptionStyle}>
              We encountered an unexpected error. Please try again or contact support if the problem persists.
            </p>

            {/* Error Details — temporarily shown in production for debugging */}
            {this.state.error && (
              <div style={errorDetailsStyle}>
                <p style={errorMessageStyle}>
                  {this.state.error.toString()}
                </p>
                <details style={detailsStyle}>
                  <summary style={summaryStyle}>
                    Stack trace
                  </summary>
                  <pre style={stackTraceStyle}>
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            {/* Retry Button */}
            <button
              onClick={this.handleRetry}
              style={buttonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0066CC';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0071E3';
              }}
            >
              <RotateCcw size={16} />
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
