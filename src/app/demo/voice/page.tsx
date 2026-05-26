'use client';

import { VoiceSchedulingAgent } from '@/components/voice/VoiceSchedulingAgent';

export default function VoiceDemoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#1a1208', padding: '40px 20px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ 
            fontSize: 34, 
            fontWeight: 700, 
            color: '#c8a96e',
            marginBottom: 8,
            fontFamily: "'Cal Sans', sans-serif"
          }}>
            Démo Agent Vocal AI
          </h1>
          <p style={{ color: '#a08060', fontSize: 16 }}>
            Parlez à l’agent de Planxo • Il réserve de vrais rendez-vous
          </p>
          <div style={{ 
            display: 'inline-block', 
            marginTop: 12, 
            fontSize: 12, 
            background: 'rgba(200,169,110,0.1)', 
            padding: '4px 14px', 
            borderRadius: 999,
            color: '#c8a96e'
          }}>
            Powered by ElevenLabs + navigateur Speech Recognition + V2 AI
          </div>
        </div>

        <VoiceSchedulingAgent 
          mode="demo" 
          professionalName="Dr. Sarah Martin"
          showTranscript={true}
        />

        <div style={{ 
          marginTop: 40, 
          padding: 24, 
          background: 'rgba(200,169,110,0.06)', 
          borderRadius: 14,
          color: '#a08060',
          fontSize: 14,
          lineHeight: 1.7
        }}>
          <strong>Comment tester :</strong><br />
          • Choisissez une langue en haut<br />
          • Cliquez sur le gros bouton ou maintenez <strong>Espace</strong> pour parler<br />
          • Dites « Je veux un rendez-vous demain à 14h30 »<br />
          • L’agent vérifie vos vrais créneaux et confirme la réservation<br />
          • Appuyez sur <strong>I</strong> n’importe quand pour interrompre
        </div>
      </div>
    </div>
  );
}
