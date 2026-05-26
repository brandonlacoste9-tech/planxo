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
  }

  render() {
    if (this.state.hasError) {
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
            <p style={{ color: '#a08060', marginBottom: 16 }}>
              The agent crashed. This is usually caused by rapid mic/speech interactions.
            </p>
            <button
              onClick={() => window.location.reload()}
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
              Reload Page
            </button>
            <div style={{ marginTop: 12, fontSize: 12, color: '#80604a' }}>
              (Check browser console for technical details)
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
