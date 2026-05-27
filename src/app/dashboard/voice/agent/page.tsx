'use client';

import { useState, useEffect } from 'react';
import { ElevenLabsAgentWidget } from '@/components/voice/ElevenLabsAgentWidget';

export default function DashboardVoiceAgentPage() {
  const [user, setUser] = useState<any>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [userRes, configRes] = await Promise.all([
          fetch('/api/v2/me'),
          fetch('/api/v2/elevenlabs/agent')
        ]);
        
        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
        }
        
        if (configRes.ok) {
          const configData = await configRes.json();
          setAgentConfig(configData.agentConfig ?? null);
        }
      } catch (e) {
        console.error('Failed to load dashboard data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Fallback to environment variable if database config is not yet set up
  const agentId = agentConfig?.agentId || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

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
          Propulsé par ElevenLabs Conversational AI. L’agent vérifie vos disponibilités réelles et crée des rendez-vous.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>Chargement de votre profil…</div>
      ) : !agentId ? (
        <div style={{ 
          padding: 40, 
          textAlign: 'center', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: 12,
          color: '#dc2626'
        }}>
          <p style={{ fontWeight: 600 }}>Configuration de l'agent manquante</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Veuillez configurer votre Agent ID ElevenLabs dans les paramètres ou via la variable d'environnement <code>NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code>.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <ElevenLabsAgentWidget
            agentId={agentId}
            mode="dashboard"
          />
        </div>
      )}

      <div style={{ marginTop: 32, fontSize: 12, color: '#888', textAlign: 'center' }}>
        Les appels sont traités nativement par ElevenLabs pour une latence minimale et une meilleure compréhension.
      </div>
    </div>
  );
}
