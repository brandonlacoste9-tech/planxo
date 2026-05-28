'use client';

import Link from 'next/link';
import { TextSchedulingAssistant } from '@/components/ai/TextSchedulingAssistant';

export default function DashboardTextAgentPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 12% 8%, rgba(15,118,110,0.24), transparent 34%), radial-gradient(circle at 94% 8%, rgba(17,24,39,0.2), transparent 38%), #f8fafc',
        padding: '28px 18px 42px',
      }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 18,
            padding: 20,
            background: '#ffffff',
          }}>
          <Link href="/dashboard/voice" style={{ fontSize: 13, color: '#374151', textDecoration: 'none' }}>
            {'<- Back to Planxo AI'}
          </Link>
          <h1 style={{ margin: '8px 0 0', fontSize: 30, lineHeight: 1.15, fontFamily: "'Cal Sans', sans-serif", color: '#111827' }}>
            Text Scheduling Workspace
          </h1>
          <p style={{ margin: '8px 0 0', color: '#4b5563' }}>
            This workspace is optimized for fast text scheduling only: choose date, load real slots, and confirm bookings.
          </p>
        </div>

        <TextSchedulingAssistant />
      </div>
    </div>
  );
}
