'use client';

import Link from 'next/link';
import { themes } from '@/lib/theme';
import { ElevenLabsAgentWidget } from '@/components/voice/ElevenLabsAgentWidget';

export default function VoiceDemoPage() {
  const c = themes.cognac;

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 14% 10%, rgba(212,148,78,0.28), transparent 35%), radial-gradient(circle at 88% 8%, rgba(196,127,58,0.2), transparent 38%), #120d09',
        padding: '34px 20px 48px',
      }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${c.border}`,
            background: c.cardBg,
            padding: 20,
            color: c.text,
            boxShadow: '0 14px 40px rgba(0,0,0,0.35)',
          }}>
          <div style={{ marginBottom: 6 }}>
            <Link href="/" style={{ color: c.textMuted, textDecoration: 'none', fontSize: 13 }}>
              {'<- Back home'}
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 31, lineHeight: 1.12, fontFamily: "'Cal Sans', sans-serif" }}>
            Planxo AI Voice Assistant
          </h1>
          <p style={{ margin: '8px 0 0', color: c.textMuted, maxWidth: 620 }}>
            Click the button, allow your microphone, and book an appointment by talking
            to the AI voice agent.
          </p>
        </div>

        <ElevenLabsAgentWidget
          mode="demo"
          username="planxo"
          eventTypeSlug="consultation-30min"
          language="fr"
        />
      </div>
    </div>
  );
}
