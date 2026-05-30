'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { themes } from '@/lib/theme';
import { TextSchedulingAssistant } from '@/components/ai/TextSchedulingAssistant';
import { ElevenLabsAgentWidget } from '@/components/voice/ElevenLabsAgentWidget';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function PlanxoAIDashboardPage() {
  const c = themes.cognac;
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/v2/elevenlabs/agent')
      .then((res) => setConnected(res.ok))
      .catch(() => setConnected(false));
  }, []);

  const tabBtn = (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    background: active ? c.accent : 'transparent',
    color: active ? c.accentText : c.textMuted,
    transition: 'all 0.2s',
  });

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 24 }}>
        <div
          style={{
            border: `1px solid ${c.border}`,
            borderRadius: 18,
            padding: 24,
            background: c.cardBg,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontFamily: "'Cal Sans', sans-serif", color: c.text }}>Planxo AI Assistant</h1>
              <p style={{ margin: '8px 0 0', color: c.textMuted, maxWidth: 680 }}>
                Manage your appointments naturally through text or voice powered by Planxo AI.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12 }}>
              <button onClick={() => setMode('text')} style={tabBtn(mode === 'text')}>Text Mode</button>
              <button onClick={() => setMode('voice')} style={tabBtn(mode === 'voice')}>Voice Mode</button>
            </div>
          </div>
        </div>

        {/* ElevenLabs status card */}
        <div
          style={{
            border: `1px solid ${c.border}`,
            borderRadius: 14,
            padding: 16,
            background: c.cardBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: connected === null ? c.textMuted : connected ? '#10b981' : '#ef4444',
              }}
            />
            <span style={{ color: c.text, fontWeight: 600 }}>
              {connected === null
                ? 'Checking ElevenLabs…'
                : connected
                ? 'ElevenLabs connected'
                : 'ElevenLabs not connected'}
            </span>
            {connected === false && (
              <span style={{ color: c.textMuted, fontSize: 13 }}>
                Set ELEVENLABS_API_KEY + ELEVENLABS_AGENT_ID (or NEXT_PUBLIC_ELEVENLABS_AGENT_ID).
              </span>
            )}
          </div>
          <Link
            href="/demo/voice"
            style={{
              color: c.accent,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: 600,
            }}>
            Test the voice agent →
          </Link>
        </div>

        {mode === 'text' ? (
          <TextSchedulingAssistant />
        ) : (
          <ElevenLabsAgentWidget
            mode="dashboard"
            username="planxo"
            eventTypeSlug="consultation-30min"
            language="fr"
          />
        )}
      </div>
    </DashboardLayout>
  );
}
