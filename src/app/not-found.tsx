import Link from 'next/link';

export default function NotFound() {
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
      <div style={{ fontSize: 72, fontWeight: 800, color: '#c8a96e', lineHeight: 1 }}>404</div>
      <h1 style={{ fontSize: 24, fontWeight: 600, margin: '16px 0 8px' }}>Page introuvable</h1>
      <p style={{ color: '#a08060', marginBottom: 32, maxWidth: 400 }}>
        Cette page n&apos;existe pas ou a été déplacée.
      </p>
      <Link href="/" style={{
        background: '#c8a96e',
        color: '#1a1208',
        padding: '12px 28px',
        borderRadius: 999,
        fontWeight: 700,
        textDecoration: 'none',
        fontSize: 15,
      }}>
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
