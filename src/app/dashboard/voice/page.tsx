'use client';

import Link from 'next/link';
import { useTheme, themes } from '@/lib/theme';
import { TextSchedulingAssistant } from '@/components/ai/TextSchedulingAssistant';

export default function PlanxoAIDashboardPage() {
  const { theme } = useTheme();
  const dark = theme !== 'default';

  const tColors = dark
    ? {
        bg: themes.cognac.bg,
        text: themes.cognac.text,
        textMuted: themes.cognac.textMuted,
        cardBg: themes.cognac.cardBg,
        border: themes.cognac.border,
      }
    : {
        bg: '#f8fafc',
        text: '#111827',
        textMuted: '#4b5563',
        cardBg: '#ffffff',
        border: 'rgba(0,0,0,0.12)',
      };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: dark
          ? 'radial-gradient(circle at 12% 10%, rgba(200,169,110,0.24), transparent 36%), radial-gradient(circle at 90% 5%, rgba(180,130,70,0.18), transparent 42%), #0f0b07'
          : 'radial-gradient(circle at 8% 10%, rgba(14,165,233,0.18), transparent 34%), radial-gradient(circle at 92% 2%, rgba(16,185,129,0.15), transparent 38%), #f1f5f9',
        color: tColors.text,
        padding: '28px 18px 42px',
      }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            border: `1px solid ${tColors.border}`,
            borderRadius: 18,
            padding: 20,
            background: tColors.cardBg,
            boxShadow: dark ? 'none' : '0 14px 40px rgba(15,23,42,0.07)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ marginBottom: 6 }}>
                <Link href="/dashboard" style={{ fontSize: 13, color: tColors.textMuted, textDecoration: 'none' }}>
                  {'<- Back to dashboard'}
                </Link>
              </div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontFamily: "'Cal Sans', sans-serif" }}>Planxo AI, text scheduling mode</h1>
              <p style={{ margin: '8px 0 0', color: tColors.textMuted, maxWidth: 680 }}>
                Voice controls have been removed from this area. Bookings are now handled with guided text inputs and real-time availability.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Link href="/dashboard/voice/agent" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, border: `1px solid ${tColors.border}`, color: tColors.text }}>
                Full text assistant
              </Link>
              <Link href="/demo/voice" style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#0f766e', color: '#fff', fontWeight: 700 }}>
                Public text demo
              </Link>
            </div>
          </div>
        </div>

        <TextSchedulingAssistant />
      </div>
    </div>
  );
}
