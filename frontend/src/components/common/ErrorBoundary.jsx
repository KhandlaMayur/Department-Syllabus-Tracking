import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--admin-surface, #ffffff)',
            border: '1px solid var(--admin-border, #e2e8f0)',
            borderRadius: 16,
            padding: '32px 28px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{
              margin: '0 0 8px 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--admin-text, #1e293b)',
            }}>
              Something went wrong
            </h2>
            <p style={{
              margin: '0 0 20px 0',
              fontSize: '0.875rem',
              color: 'var(--admin-text-muted, #64748b)',
              lineHeight: 1.5,
            }}>
              An unexpected error occurred while rendering this page. You can try refreshing or returning to the dashboard.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 20,
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                color: 'var(--admin-danger, #dc2626)',
                textAlign: 'left',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--admin-accent, #00A9B4)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Reload Page
              </button>
              <button
                onClick={() => { window.location.href = '/hod'; }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--admin-border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--admin-text, #334155)',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
