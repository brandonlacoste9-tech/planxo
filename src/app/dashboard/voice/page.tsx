'use client';

import { useState, useEffect } from 'react';
import { useTheme, themes, type ThemeName } from "@/lib/theme";

interface VoiceCall {
  id: string;
  callSid: string;
  purpose: string;
  direction: string;
  status: string;
  from: string;
  to: string;
  professionalName: string;
  transcript: { role: string; text: string; timestamp: string }[];
  recordingUrl?: string;
  recordingDuration?: number;
  startedAt: string;
  endedAt?: string;
}

export default function VoiceDashboard() {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [stats, setStats] = useState({
    totalCalls: 0,
    completedCalls: 0,
    avgDuration: 0,
    successRate: 0,
  });

  // ElevenLabs voice state
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [testText, setTestText] = useState("Bonjour, je suis l'assistant vocal de Planxo. Comment puis-je vous aider aujourd'hui ?");
  const [voiceError, setVoiceError] = useState('');

  const { theme } = useTheme();
  const dark = theme !== "default";
  const tColors = dark ? {
    bg: themes.cognac.bg, text: themes.cognac.text, textMuted: themes.cognac.textMuted,
    cardBg: themes.cognac.cardBg, border: themes.cognac.border, accent: themes.cognac.accent,
  } : {
    bg: "#fff", text: "#242424", textMuted: "#898989",
    cardBg: "#fff", border: "rgba(0,0,0,0.08)", accent: "#242424",
  };

  useEffect(() => {
    fetchCalls();
    fetchCredits();
    fetchVoices();
  }, []);

  async function fetchCredits() {
    try {
      const res = await fetch('/api/voice/credits');
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Failed to fetch credits:', err);
    }
  }

  async function fetchCalls() {
    try {
      const res = await fetch('/api/voice/calls');
      const data = await res.json();
      setCalls(data.calls || []);
      
      const total = data.calls?.length || 0;
      const completed = data.calls?.filter((c: VoiceCall) => c.status === 'completed').length || 0;
      const avgDur = total > 0 
        ? data.calls.reduce((acc: number, c: VoiceCall) => acc + (c.recordingDuration || 0), 0) / total 
        : 0;
      
      setStats({
        totalCalls: total,
        completedCalls: completed,
        avgDuration: Math.round(avgDur),
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      });
    } catch (err) {
      console.error('Failed to fetch calls:', err);
    } finally {
      setLoading(false);
    }
  }

  // Fetch ElevenLabs voices
  async function fetchVoices() {
    try {
      const res = await fetch('/api/v2/elevenlabs/voices');
      if (res.ok) {
        const data = await res.json();
        if (data.voices) {
          setVoices(data.voices);
          if (data.voices.length > 0 && !selectedVoice) {
            setSelectedVoice(data.voices[0].id);
          }
        } else if (data.error) {
          setVoiceError(data.error);
        }
      } else {
        const errData = await res.json();
        setVoiceError(errData.error || 'Failed to load voices');
      }
    } catch (err: any) {
      console.error('Failed to fetch voices:', err);
      setVoiceError('Network error loading voices');
    }
  }

  async function testVoice() {
    if (!selectedVoice) return;
    try {
      const res = await fetch('/api/v2/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId: selectedVoice, text: testText })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
      } else {
        alert('Erreur TTS');
      }
    } catch (err) {
      console.error('TTS test failed:', err);
    }
  }

  function formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-CA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'failed': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#f59e0b';
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24, color: tColors.text, background: tColors.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <a href="/dashboard" style={{ fontSize: 14, color: tColors.textMuted, textDecoration: 'none' }}>← Retour au tableau de bord</a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, fontFamily: "'Cal Sans', sans-serif" }}>
              🤖 Planxo AI
            </h1>
            <p style={{ color: tColors.textMuted }}>Agent vocal intelligent pour automatiser vos rendez-vous</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a 
              href="/dashboard/voice/credits" 
              style={{
                padding: '10px 20px',
                background: tColors.cardBg,
                color: tColors.text,
                border: `1px solid ${tColors.border}`,
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              💰 Crédits
            </a>
            <a 
              href="/dashboard/voice/workflows" 
              style={{
                padding: '10px 20px',
                background: tColors.cardBg,
                color: tColors.text,
                border: `1px solid ${tColors.border}`,
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              🔄 Workflows
            </a>
            <a 
              href="/demo/voice" 
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #c8a96e, #a07840)',
                color: '#1a1208',
                borderRadius: 10,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Tester la démo →
            </a>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard title="Appels totaux" value={stats.totalCalls} icon="📞" color="#3b82f6" tColors={tColors} />
        <StatCard title="Complétés" value={stats.completedCalls} icon="✓" color="#10b981" tColors={tColors} />
        <StatCard title="Durée moyenne" value={`${formatDuration(stats.avgDuration)}`} icon="⏱" color="#f59e0b" tColors={tColors} />
        <StatCard title="Taux de succès" value={`${stats.successRate}%`} icon="📈" color="#8b5cf6" tColors={tColors} />
        <a href="/dashboard/voice/credits" style={{ textDecoration: 'none' }}>
          <StatCard 
            title="Crédits disponibles" 
            value={`$${(creditBalance / 100).toFixed(2)}`} 
            icon="💰" 
            color={creditBalance < 300 ? "#ef4444" : "#10b981"} 
            tColors={tColors} 
          />
        </a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Calls List */}
        <div style={{ 
          background: tColors.cardBg, 
          border: `1px solid ${tColors.border}`, 
          borderRadius: 12, 
          padding: 24 
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Appels récents</h2>
          
          {loading ? (
            <p style={{ color: tColors.textMuted }}>Chargement...</p>
          ) : calls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: tColors.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📞</div>
              <p>Aucun appel pour le moment</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>Les appels apparaîtront ici une fois que vous aurez configuré votre numéro Twilio</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {calls.map((call) => (
                <div
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${selectedCall?.id === call.id ? tColors.accent : tColors.border}`,
                    cursor: 'pointer',
                    background: selectedCall?.id === call.id ? (dark ? 'rgba(200,169,110,0.1)' : '#eff6ff') : tColors.cardBg,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{call.purpose === 'inbound_booking' ? 'Réservation' : call.purpose}</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 500,
                      background: getStatusColor(call.status) + '20',
                      color: getStatusColor(call.status),
                    }}>
                      {call.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: tColors.textMuted }}>
                    {formatDate(call.startedAt)} · {formatDuration(call.recordingDuration)}
                  </div>
                  <div style={{ fontSize: 13, color: tColors.textMuted, marginTop: 4 }}>
                    {call.direction === 'inbound' ? 'Entrant' : 'Sortant'} · {call.to}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call Detail */}
        <div style={{ 
          background: tColors.cardBg, 
          border: `1px solid ${tColors.border}`, 
          borderRadius: 12, 
          padding: 24 
        }}>
          {selectedCall ? (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Détails de l&apos;appel</h2>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: tColors.textMuted, marginBottom: 4 }}>Numéro d&apos;appel</div>
                <div style={{ fontWeight: 500, fontSize: 13, fontFamily: 'monospace' }}>{selectedCall.callSid}</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: tColors.textMuted, marginBottom: 4 }}>Transcription</div>
                <div style={{ 
                  background: dark ? 'rgba(0,0,0,0.2)' : '#f9fafb', 
                  borderRadius: 8, 
                  padding: 12, 
                  maxHeight: 300, 
                  overflow: 'auto',
                  fontSize: 14,
                }}>
                  {selectedCall.transcript?.map((msg, idx) => (
                    <div key={idx} style={{ marginBottom: 12 }}>
                      <span style={{ 
                        fontWeight: 600, 
                        color: msg.role === 'assistant' ? '#c8a96e' : '#10b981',
                        fontSize: 12,
                        textTransform: 'uppercase',
                      }}>
                        {msg.role === 'assistant' ? 'Agent' : 'Client'}
                      </span>
                      <p style={{ margin: '4px 0 0', color: tColors.text }}>{msg.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCall.recordingUrl && (
                <div>
                  <div style={{ fontSize: 13, color: tColors.textMuted, marginBottom: 8 }}>Enregistrement</div>
                  <audio controls src={selectedCall.recordingUrl} style={{ width: '100%' }} />
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: tColors.textMuted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👆</div>
              <p>Sélectionnez un appel pour voir les détails</p>
            </div>
          )}
        </div>
      </div>

      {/* ElevenLabs Voice Settings */}
      <div style={{ 
        marginTop: 32, 
        background: tColors.cardBg, 
        border: `1px solid ${tColors.border}`, 
        borderRadius: 12, 
        padding: 24 
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Voix ElevenLabs (AI Tab)</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: tColors.textMuted, display: 'block', marginBottom: 8 }}>
              Sélectionner une voix
            </label>
            <select 
              value={selectedVoice} 
              onChange={e => setSelectedVoice(e.target.value)}
              style={{ 
                width: '100%', padding: '10px 14px', borderRadius: 8, 
                border: `1px solid ${tColors.border}`, background: tColors.bg, 
                color: tColors.text, fontSize: 14 
              }}
              disabled={voices.length === 0}
            >
              {voiceError ? (
                <option>Erreur: {voiceError}</option>
              ) : voices.length === 0 ? (
                <option>Chargement des voix...</option>
              ) : (
                voices.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                ))
              )}
            </select>
            <button 
              onClick={testVoice}
              style={{ 
                marginTop: 12, padding: '10px 20px', 
                background: 'linear-gradient(135deg, #c8a96e, #a07840)', 
                color: '#1a1208', border: 'none', borderRadius: 8, 
                fontWeight: 600, cursor: 'pointer', fontSize: 14 
              }}
            >
              ▶ Tester la voix
            </button>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: tColors.textMuted, display: 'block', marginBottom: 8 }}>
              Script de test
            </label>
            <textarea 
              value={testText} 
              onChange={e => setTestText(e.target.value)}
              rows={3}
              style={{ 
                width: '100%', padding: '10px 14px', borderRadius: 8, 
                border: `1px solid ${tColors.border}`, background: tColors.bg, 
                color: tColors.text, fontSize: 14, resize: 'vertical' 
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 16, padding: 16, background: dark ? 'rgba(200,169,110,0.1)' : '#fef3c7', borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: dark ? '#c8a96e' : '#92400e', margin: 0 }}>
            💡 Les voix sont synchronisées avec l'API ElevenLabs. La sélection est utilisée pour les appels vocaux et rappels IA.
          </p>
        </div>
      </div>

      {/* Original Configuration Section */}
      <div style={{ 
        marginTop: 32, 
        background: tColors.cardBg, 
        border: `1px solid ${tColors.border}`, 
        borderRadius: 12, 
        padding: 24 
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <SettingItem label="Numéro de téléphone" value="Non configuré" tColors={tColors} />
          <SettingItem label="Voix" value={selectedVoice ? voices.find(v => v.id === selectedVoice)?.name || 'Céline' : 'Céline (Français Québec)'} tColors={tColors} />
          <SettingItem label="Heures d'ouverture" value="Lun-Ven 9h-17h" tColors={tColors} />
          <SettingItem label="Tarification" value="~$0.15/minute" tColors={tColors} />
        </div>
        <div style={{ marginTop: 16, padding: 16, background: dark ? 'rgba(200,169,110,0.1)' : '#fef3c7', borderRadius: 8 }}>
          <p style={{ fontSize: 13, color: dark ? '#c8a96e' : '#92400e', margin: 0 }}>
            💡 Pour activer l'agent vocal, consultez le{' '}
            <a href="/docs/VOICE_AGENT_SETUP.md" style={{ color: dark ? '#c8a96e' : '#92400e', fontWeight: 600 }}>
              guide de configuration
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color, tColors }: { title: string; value: string | number; icon: string; color: string; tColors: any }) {
  return (
    <div style={{ 
      background: tColors.cardBg, 
      border: `1px solid ${tColors.border}`, 
      borderRadius: 12, 
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 24, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ fontSize: 14, color: tColors.textMuted }}>{title}</div>
    </div>
  );
}

function SettingItem({ label, value, tColors }: { label: string; value: string; tColors: any }) {
  return (
    <div style={{ padding: 12, background: tColors.bg, borderRadius: 8, border: `1px solid ${tColors.border}` }}>
      <div style={{ fontSize: 12, color: tColors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4, color: tColors.text }}>{value}</div>
    </div>
  );
}
