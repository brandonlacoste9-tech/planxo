'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#120d09',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#f5ead8',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center',
      padding: '40px 20px',
    }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: '#c8a96e', lineHeight: 1 }}>500</div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '16px 0 8px' }}>Une erreur est survenue</h1>
      <p style={{ color: '#a08060', marginBottom: 32, maxWidth: 400 }}>
        Quelque chose s&apos;est mal passé. Veuillez réessayer.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={reset} style={{
          background: '#c8a96e',
          color: '#1a1208',
          padding: '12px 28px',
          borderRadius: 999,
          fontWeight: 700,
          border: 'none',
          cursor: 'pointer',
          fontSize: 15,
        }}>
          Réessayer
        </button>
        <Link href="/" style={{
          background: 'transparent',
          color: '#c8a96e',
          padding: '12px 28px',
          borderRadius: 999,
          fontWeight: 700,
          textDecoration: 'none',
          border: '1px solid rgba(200,169,110,0.4)',
          fontSize: 15,
        }}>
          Accueil
        </Link>
      </div>
    </div>
  );
}
