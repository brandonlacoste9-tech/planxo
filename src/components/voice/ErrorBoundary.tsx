'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class VoiceAgentErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VoiceSchedulingAgent] Client-side crash caught:', error, errorInfo);
    // Also log a more readable version
    console.error('Error message:', error?.message);
    console.error('Stack:', error?.stack);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Unknown error';

      return (
        this.props.fallback || (
          <div style={{
            padding: 24,
            background: '#1a1208',
            color: '#f5ead8',
            borderRadius: 12,
            border: '1px solid #c8a96e',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#c8a96e', marginBottom: 12 }}>Something went wrong with the voice agent</h3>
            
            <p style={{ color: '#a08060', marginBottom: 8, fontSize: 13 }}>
              {errorMessage}
            </p>
            <p style={{ color: '#a08060', marginBottom: 16, fontSize: 14 }}>
              This is usually caused by rapid mic/speech interactions or browser compatibility issues.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined })}
                style={{
                  background: '#c8a96e',
                  color: '#1a1208',
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Try Again
              </button>

              <button
                onClick={() => window.location.reload()}
                style={{
                  background: 'transparent',
                  color: '#c8a96e',
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid #c8a96e',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reload Page
              </button>
            </div>

            <div style={{ marginTop: 16, fontSize: 11, color: '#80604a' }}>
              Check browser console (F12) for technical details. If this keeps happening, try using the mic more slowly or disable "Mode continu".
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
