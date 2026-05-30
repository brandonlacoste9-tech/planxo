'use client';

import React, { useCallback, useRef, useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { VoiceAgentErrorBoundary } from './ErrorBoundary';

const DEFAULT_AGENT_ID =
  process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || 'agent_1901ksv92wxhffxbsg30b0mdhkv1';

type AgentLanguage = 'fr' | 'en';

interface ElevenLabsAgentWidgetProps {
  /** Planxo user/host the agent books for (passed to tool routes). */
  username?: string;
  /** Event type slug to book. */
  eventTypeSlug?: string;
  /** Override the Conversational AI agent ID (defaults to env / built-in). */
  agentId?: string;
  /** Spoken language for the agent. Defaults to French (Quebec). */
  language?: AgentLanguage;
  mode?: 'demo' | 'dashboard';
  className?: string;
}

function agentOverrides(language: AgentLanguage) {
  return {
    agent: {
      language,
      prompt: {
        prompt:
          language === 'fr'
            ? `Tu es un assistant de prise de rendez-vous pour Planxo. Parle toujours en français.
             Vérifie les disponibilités, collecte le nom et le courriel du client, et confirme le rendez-vous.
             Fuseau horaire : America/Toronto.`
            : `You are a scheduling assistant for Planxo. Always speak in English.
             Check availability, collect the caller's name and email, and confirm the appointment.
             Timezone: America/Toronto.`,
      },
      firstMessage:
        language === 'fr'
          ? "Bonjour ! Je suis l'assistant de planification de Planxo. Comment puis-je vous aider aujourd'hui ?"
          : "Hello! I'm the Planxo scheduling assistant. How can I help you today?",
    },
  };
}

interface TranscriptEntry {
  role: 'user' | 'ai';
  text: string;
}

const COLORS = {
  bg: '#1a1208',
  cardBg: '#0f0a05',
  gold: '#c8a96e',
  text: '#f5ead8',
  textMuted: '#a08060',
  border: 'rgba(200,169,110,0.25)',
  red: '#ef4444',
  green: '#10b981',
};

function statusLabel(status: string, isSpeaking: boolean): { text: string; color: string } {
  switch (status) {
    case 'connecting':
      return { text: 'Connecting…', color: COLORS.gold };
    case 'connected':
      return { text: isSpeaking ? 'Agent speaking…' : 'Listening…', color: COLORS.green };
    case 'error':
      return { text: 'Error', color: COLORS.red };
    default:
      return { text: 'Idle', color: COLORS.textMuted };
  }
}

function AgentConversation({
  mode,
  className,
  agentId,
  language: initialLanguage,
}: {
  mode: 'demo' | 'dashboard';
  className: string;
  agentId: string;
  language: AgentLanguage;
}) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [language, setLanguage] = useState<AgentLanguage>(initialLanguage);

  const conversation = useConversation({
    onConnect: () => setError(null),
    onError: (message: string) => setError(message || 'Conversation error'),
    onMessage: ({ message, role }) =>
      setTranscript((prev) => [...prev, { role: role === 'user' ? 'user' : 'ai', text: message }]),
  });

  const { status, isSpeaking, startSession, endSession } = conversation;
  const isActive = status === 'connected' || status === 'connecting';
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      // Mic permission must be granted before the session opens.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch('/api/v2/elevenlabs/agent');
      const data = await res.json().catch(() => ({}));

      // SDK types don't fully expose `overrides`, so cast the session config as any.
      const overrides = agentOverrides(language);

      if (res.ok && data.signedUrl) {
        await startSession({ signedUrl: data.signedUrl, overrides } as any);
      } else {
        // Connect with the public agent ID via WebRTC (lower latency).
        await startSession({
          agentId: data.agentId || agentId,
          connectionType: 'webrtc',
          overrides,
        } as any);
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow the mic and try again.');
      } else {
        setError(err?.message || 'Could not start the voice agent');
      }
    } finally {
      setStarting(false);
    }
  }, [startSession, agentId, language]);

  const stop = useCallback(async () => {
    try {
      await endSession();
    } catch {
      /* already closed */
    }
  }, [endSession]);

  const { text: statusText, color: statusColor } = statusLabel(status, isSpeaking);
  const minHeight = mode === 'demo' ? 300 : 420;

  return (
    <div
      className={className}
      style={{
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.cardBg,
        padding: 20,
        color: COLORS.text,
        fontFamily: 'system-ui, sans-serif',
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: status === 'connected' ? `0 0 0 4px ${COLORS.green}22` : 'none',
          }}
        />
        <span style={{ fontWeight: 600, color: statusColor }}>{statusText}</span>
      </div>

      {!isActive && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {(['fr', 'en'] as AgentLanguage[]).map((lng) => {
            const selected = language === lng;
            return (
              <button
                key={lng}
                onClick={() => setLanguage(lng)}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 999,
                  cursor: 'pointer',
                  border: `1px solid ${COLORS.border}`,
                  background: selected ? COLORS.gold : 'transparent',
                  color: selected ? COLORS.bg : COLORS.textMuted,
                }}>
                {lng.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        {!isActive ? (
          <button
            onClick={start}
            disabled={starting}
            style={{
              padding: '16px 34px',
              fontSize: 17,
              fontWeight: 700,
              borderRadius: 999,
              border: 'none',
              background: COLORS.gold,
              color: COLORS.bg,
              cursor: starting ? 'wait' : 'pointer',
              minWidth: 230,
            }}
          >
            {starting ? 'Starting…' : '🎤 Talk to the assistant'}
          </button>
        ) : (
          <button
            onClick={stop}
            style={{
              padding: '16px 34px',
              fontSize: 17,
              fontWeight: 700,
              borderRadius: 999,
              border: `1px solid ${COLORS.red}`,
              background: '#3f1f1f',
              color: COLORS.red,
              cursor: 'pointer',
              minWidth: 230,
            }}
          >
            ⏹ End call
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: COLORS.red, textAlign: 'center', fontSize: 14 }}>{error}</div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 16,
          background: COLORS.bg,
          minHeight: 160,
        }}
      >
        {transcript.length === 0 ? (
          <div style={{ color: COLORS.textMuted, textAlign: 'center', paddingTop: 24 }}>
            Click the button and start speaking to book an appointment.
          </div>
        ) : (
          transcript.map((entry, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                display: 'flex',
                justifyContent: entry.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '8px 14px',
                  borderRadius: 14,
                  background: entry.role === 'user' ? COLORS.gold : COLORS.cardBg,
                  color: entry.role === 'user' ? COLORS.bg : COLORS.text,
                  border: entry.role === 'ai' ? `1px solid ${COLORS.border}` : 'none',
                }}
              >
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
                  {entry.role === 'user' ? 'You' : 'Assistant'}
                </div>
                {entry.text}
              </div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
}

/**
 * ElevenLabs Conversational AI widget.
 *
 * Connects to a Conversational AI agent via the official SDK, handles mic
 * permission and connection status, shows a live transcript, and ends cleanly.
 * Booking/availability run server-side through the agent's configured tools
 * (POST /api/v2/elevenlabs/tools/booking and /tools/availability); we also expose
 * the same operations as client tools so a browser-connected agent can act
 * without a server round-trip.
 */
export function ElevenLabsAgentWidget({
  username = 'planxo',
  eventTypeSlug = 'consultation-30min',
  agentId = DEFAULT_AGENT_ID,
  language = 'fr',
  mode = 'dashboard',
  className = '',
}: ElevenLabsAgentWidgetProps) {
  const clientTools = {
    check_availability: async (params: { date?: string }) => {
      const url = `/api/v2/ai/availability?date=${encodeURIComponent(params.date || '')}&username=${encodeURIComponent(username)}&eventTypeSlug=${encodeURIComponent(eventTypeSlug)}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const times: string[] = data.availableTimes || [];
      return times.length
        ? `Available times on ${params.date}: ${times.join(', ')}`
        : `No availability found for ${params.date}.`;
    },
    book_appointment: async (params: {
      name: string;
      email: string;
      start_time: string;
    }) => {
      const res = await fetch('/api/v2/elevenlabs/tools/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, username, eventTypeSlug }),
      });
      const data = await res.json().catch(() => ({}));
      return data.agentMessage || data.message || (data.success ? 'Booked.' : 'Booking failed.');
    },
  };

  return (
    <VoiceAgentErrorBoundary>
      <ConversationProvider clientTools={clientTools}>
        <AgentConversation mode={mode} className={className} agentId={agentId} language={language} />
      </ConversationProvider>
    </VoiceAgentErrorBoundary>
  );
}

export default ElevenLabsAgentWidget;
