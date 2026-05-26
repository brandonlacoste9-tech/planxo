'use client';

import { useState, useEffect } from 'react';
import { VoiceSchedulingAgent } from '@/components/voice/VoiceSchedulingAgent';
import { VoiceAgentErrorBoundary } from '@/components/voice/ErrorBoundary';

export default function DashboardVoiceAgentPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/v2/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (e) {
        console.error('Failed to load user', e);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  const professionalName = user?.name || user?.username || 'Votre pratique';
  const defaultEvent = user?.eventTypes?.[0]?.slug || 'appel-de-decouverte';

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/dashboard/voice" style={{ color: '#c8a96e', textDecoration: 'none', fontSize: 14 }}>
          ← Retour à la voix
        </a>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Agent Vocal de Réservation</h1>
        <p style={{ color: '#666' }}>
          Parlez naturellement. L’agent vérifie vos disponibilités réelles et crée des rendez-vous.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Chargement de votre profil…</div>
      ) : (
        <VoiceAgentErrorBoundary>
          <VoiceSchedulingAgent
            mode="dashboard"
            professionalName={professionalName}
            username={user?.username || 'planxo'}
            eventTypeSlug={defaultEvent}
            defaultLanguage="fr-CA"
          />
        </VoiceAgentErrorBoundary>
      )}

      <div style={{ marginTop: 32, fontSize: 12, color: '#888', textAlign: 'center' }}>
        Utilise vos vrais créneaux et vos vrais clients. Les appels sont enregistrés dans l’historique.
      </div>
    </div>
  );
}
