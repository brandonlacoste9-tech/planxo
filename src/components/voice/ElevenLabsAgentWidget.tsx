'use client';

import React, { useEffect, useState } from 'react';

interface ElevenLabsAgentWidgetProps {
  agentId: string;
  mode?: 'demo' | 'dashboard';
  className?: string;
  onConversationStart?: () => void;
  onConversationEnd?: (data: any) => void;
}

/**
 * ElevenLabs Agent Widget Component
 * 
 * Embeds the ElevenLabs Conversational AI widget for appointment scheduling.
 * Handles agent initialization, conversation events, and error handling.
 */
export function ElevenLabsAgentWidget({
  agentId,
  mode = 'dashboard',
  className = '',
  onConversationStart,
  onConversationEnd
}: ElevenLabsAgentWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load and initialize ElevenLabs widget
  useEffect(() => {
    const initializeWidget = async () => {
      try {
        // Load ElevenLabs widget script
        const script = document.createElement('script');
        script.src = 'https://elevenlabs.io/convai-widget/index.js';
        script.async = true;

        script.onload = () => {
          // Wait for window.ElevenLabsConvAI to be available
          let attempts = 0;
          const checkWidget = setInterval(() => {
            attempts++;
            if (window.ElevenLabsConvAI) {
              clearInterval(checkWidget);
              
              try {
                // Initialize widget with agent ID
                if (typeof window.ElevenLabsConvAI.setAgentId === 'function') {
                  window.ElevenLabsConvAI.setAgentId(agentId);
                }

                // Set up event listeners
                if (typeof window.ElevenLabsConvAI.on === 'function') {
                  window.ElevenLabsConvAI.on('conversation_start', () => {
                    console.log('[ElevenLabs Widget] Conversation started');
                    onConversationStart?.();
                  });

                  window.ElevenLabsConvAI.on('conversation_end', (data: any) => {
                    console.log('[ElevenLabs Widget] Conversation ended', data);
                    onConversationEnd?.(data);
                  });

                  window.ElevenLabsConvAI.on('error', (error: any) => {
                    console.error('[ElevenLabs Widget] Error:', error);
                    setError('An error occurred during the conversation');
                  });
                }

                setIsInitialized(true);
                setIsLoading(false);
              } catch (initErr) {
                console.error('[ElevenLabs Widget] Initialization error:', initErr);
                setError('Failed to initialize voice agent');
                setIsLoading(false);
              }
            } else if (attempts > 50) { // Stop after 5 seconds
              clearInterval(checkWidget);
              setError('Failed to load voice agent components');
              setIsLoading(false);
            }
          }, 100);

          // Timeout after 5 seconds
          setTimeout(() => {
            clearInterval(checkWidget);
            if (!isInitialized) {
              setError('Failed to initialize widget');
              setIsLoading(false);
            }
          }, 5000);
        };

        script.onerror = () => {
          setError('Failed to load ElevenLabs widget');
          setIsLoading(false);
        };

        document.body.appendChild(script);

        return () => {
          if (document.body.contains(script)) {
            document.body.removeChild(script);
          }
        };
      } catch (err: any) {
        setError(err.message || 'Failed to initialize widget');
        setIsLoading(false);
      }
    };

    initializeWidget();
  }, [agentId, onConversationStart, onConversationEnd, isInitialized]);

  // Render error state
  if (error) {
    return (
      <div
        className={`p-6 text-center rounded-lg border border-red-200 bg-red-50 ${className}`}
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#dc2626',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          backgroundColor: '#fef2f2'
        }}
      >
        <p className="font-semibold">{error}</p>
        <p className="text-sm mt-2">Please try refreshing the page or contact support.</p>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-gray-50 ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          color: '#666',
          backgroundColor: '#f9fafb',
          borderRadius: '8px'
        }}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
          <p>Loading voice agent...</p>
          <p className="text-xs text-gray-500 mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  // Render widget container
  return (
    <div
      className={`rounded-lg overflow-hidden ${className}`}
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: mode === 'demo' ? '300px' : '500px'
      }}
    >
      <div
        id="elevenlabs-convai-widget"
        style={{
          width: '100%',
          height: '100%',
          minHeight: mode === 'demo' ? '300px' : '500px'
        }}
      />
    </div>
  );
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ElevenLabsConvAI?: {
      setAgentId: (id: string) => void;
      on: (event: string, callback: (data?: any) => void) => void;
      [key: string]: any;
    };
  }
}

export default ElevenLabsAgentWidget;
