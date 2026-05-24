'use client';

import { useState, useEffect } from 'react';

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
  const [stats, setStats] = useState({
    totalCalls: 0,
    completedCalls: 0,
    avgDuration: 0,
    successRate: 0,
  });

  useEffect(() => {
    fetchCalls();
  }, []);

  async function fetchCalls() {
    try {
      const res = await fetch('/api/voice/calls');
      const data = await res.json();
      setCalls(data.calls || []);
      
      // Calculate stats
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
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 40 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Agent Vocal AI</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>Gérez vos appels et analysez les conversations</p>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        <StatCard title="Appels totaux" value={stats.totalCalls} icon="📞" color="#3b82f6" />
        <StatCard title="Complétés" value={stats.completedCalls} icon="✓" color="#10b981" />
        <StatCard title="Durée moyenne" value={`${formatDuration(stats.avgDuration)}`} icon="⏱" color="#f59e0b" />
        <StatCard title="Taux de succès" value={`${stats.successRate}%`} icon="📈" color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Calls List */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Appels récents</h2>
          
          {loading ? (
            <p style={{ color: '#6b7280' }}>Chargement...</p>
          ) : calls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📞</div>
              <p>Aucun appel pour le moment</p>
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
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    background: selectedCall?.id === call.id ? '#eff6ff' : '#fff',
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
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    {formatDate(call.startedAt)} · {formatDuration(call.recordingDuration)}
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
                    {call.direction === 'inbound' ? 'Entrant' : 'Sortant'} · {call.to}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Call Detail */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          {selectedCall ? (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Détails de l'appel</h2>
              
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Numéro d'appel</div>
                <div style={{ fontWeight: 500 }}>{selectedCall.callSid}</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>Transcription</div>
                <div style={{ 
                  background: '#f9fafb', 
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
                        color: msg.role === 'assistant' ? '#3b82f6' : '#10b981',
                        fontSize: 12,
                        textTransform: 'uppercase',
                      }}>
                        {msg.role === 'assistant' ? 'Agent' : 'Client'}
                      </span>
                      <p style={{ margin: '4px 0 0', color: '#374151' }}>{msg.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedCall.recordingUrl && (
                <div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Enregistrement</div>
                  <audio controls src={selectedCall.recordingUrl} style={{ width: '100%' }} />
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👆</div>
              <p>Sélectionnez un appel pour voir les détails</p>
            </div>
          )}
        </div>
      </div>

      {/* Settings Section */}
      <div style={{ marginTop: 32, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Configuration de l'agent vocal</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
          <SettingItem label="Numéro de téléphone" value="+1 (xxx) xxx-xxxx" />
          <SettingItem label="Voix" value="Céline (Français Québec)" />
          <SettingItem label="Heures d'ouverture" value="Lun-Ven 9h-17h" />
          <SettingItem label="Tarification" value="~$0.15/minute" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  return (
    <div style={{ 
      background: '#fff', 
      border: '1px solid #e5e7eb', 
      borderRadius: 12, 
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 24 }}>{icon}</span>
        <span style={{ fontSize: 24, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ fontSize: 14, color: '#6b7280' }}>{title}</div>
    </div>
  );
}

function SettingItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
      <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{value}</div>
    </div>
  );
}
