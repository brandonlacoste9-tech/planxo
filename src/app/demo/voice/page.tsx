'use client';

import Link from 'next/link';
import { TextSchedulingAssistant } from '@/components/ai/TextSchedulingAssistant';

export default function TextDemoPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at 14% 10%, rgba(37,99,235,0.26), transparent 35%), radial-gradient(circle at 88% 8%, rgba(14,165,233,0.18), transparent 38%), #0b1120',
        padding: '34px 20px 48px',
      }}>
      <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div
          style={{
            borderRadius: 18,
            border: '1px solid rgba(255,255,255,0.22)',
            background: 'rgba(15,23,42,0.78)',
            padding: 20,
            color: '#e2e8f0',
          }}>
          <div style={{ marginBottom: 6 }}>
            <Link href="/" style={{ color: '#93c5fd', textDecoration: 'none', fontSize: 13 }}>
              {'<- Back home'}
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 31, lineHeight: 1.12, fontFamily: "'Cal Sans', sans-serif" }}>
            Planxo AI Text Scheduling Demo
          </h1>
          <p style={{ margin: '8px 0 0', color: '#cbd5e1', maxWidth: 760 }}>
            Try the same scheduling flow your users get in production, fully text-based and connected to real availability.
          </p>
        </div>

        <TextSchedulingAssistant />
      </div>
    </div>
  );
}
