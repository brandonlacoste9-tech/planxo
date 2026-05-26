'use client';

import { useState, useRef, useEffect } from 'react';
import { ConversationManager } from '@/lib/voice/conversation';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function VoiceDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [state, setState] = useState('greeting');
  const [context, setContext] = useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const conversationRef = useRef<ConversationManager | null>(null);

  // ElevenLabs voice selector for demo
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize conversation
    const session = {
      callSid: 'demo-' + Date.now(),
      userId: 'demo-user',
      state: 'greeting',
      context: {
        professionalName: 'Dr. Sarah Martin',
      },
      startTime: new Date(),
      audioBuffer: [],
      transcript: [],
    };

    // Real AI tools powered by the new V2 scheduling endpoints + ElevenLabs voice
    const aiTools = {
      checkAvailability: async (date: string) => {
        try {
          const res = await fetch(`/api/v2/ai/availability?date=${date}`);
          if (!res.ok) throw new Error('Failed to fetch availability');
          const data = await res.json();
          return {
            availableTimes: data.availableTimes || [],
            rawSlots: data.rawSlots,
          };
        } catch (e) {
          console.error('Availability check failed:', e);
          return { availableTimes: [] };
        }
      },
      createBooking: async (params: { name: string; email: string; start: string; date: string; time: string }) => {
        try {
          const res = await fetch('/api/v2/ai/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: params.name,
              email: params.email,
              start: params.start,
              username: 'planxo',
              eventTypeSlug: 'appel-de-decouverte',
            }),
          });
          const data = await res.json();
          return {
            success: !!data.success,
            message: data.message || data.error,
            booking: data.booking,
          };
        } catch (e: any) {
          console.error('Booking failed:', e);
          return { success: false, message: e.message };
        }
      },
    };

    conversationRef.current = new ConversationManager(session, {
      onStateChange: (newState) => {
        setState(newState);
      },
      onResponse: (text) => {
        handleAssistantResponse(text);
      },
    }, aiTools);

    // Send initial greeting
    conversationRef.current.generateGreeting();

    return () => {
      conversationRef.current = null;
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Audio playback state for ElevenLabs TTS
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  // Refs to avoid stale closures in ConversationManager callbacks
  const autoSpeakRef = useRef(autoSpeak);
  const selectedVoiceRef = useRef(selectedVoice);
  autoSpeakRef.current = autoSpeak;
  selectedVoiceRef.current = selectedVoice;

  // Fetch ElevenLabs voices for demo (public demo endpoint)
  useEffect(() => {
    async function loadVoices() {
      try {
        const res = await fetch('/api/demo/elevenlabs/voices');
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
        }
      } catch (e: any) {
        setVoiceError('Failed to load voices');
      }
    }
    loadVoices();
  }, []);

  // Speak the initial greeting once we have a voice selected
  const hasSpokenInitialGreeting = useRef(false);
  useEffect(() => {
    if (selectedVoice && !hasSpokenInitialGreeting.current && messages.length > 0) {
      // Find the first assistant message (the greeting) and speak it
      const firstAssistant = messages.find(m => m.role === 'assistant');
      if (firstAssistant && autoSpeak) {
        hasSpokenInitialGreeting.current = true;
        setTimeout(() => speak(firstAssistant.text), 400);
      }
    }
  }, [selectedVoice, messages.length]);

  const handleSendMessage = async (text: string, isInitial = false) => {
    if (!conversationRef.current || isProcessing) return;

    stopSpeaking(); // stop any ongoing voice when user speaks
    setIsProcessing(true);
    
    if (!isInitial && text.trim()) {
      setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    }

    try {
      const response = await conversationRef.current.processUserInput(text);
      if (isInitial) {
        handleAssistantResponse(response);
      }
    } catch (err) {
      console.error('Conversation error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendMessage(inputText);
    setInputText('');
  };

  // ElevenLabs TTS playback
  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speak = async (text: string) => {
    if (!selectedVoice || !text.trim()) return;

    stopSpeaking(); // stop any previous

    try {
      setIsSpeaking(true);

      const res = await fetch('/api/demo/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice,
          language: 'fr',
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `TTS failed: ${res.status}`);
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        console.error('Audio playback error');
      };

      await audio.play();
    } catch (err) {
      console.error('Speak error:', err);
      setIsSpeaking(false);
      // Fallback: still show the text even if voice fails
    }
  };

  // Enhanced response handler that includes voice (uses refs to avoid stale state)
  const handleAssistantResponse = (text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text, timestamp: new Date() }]);
    setIsProcessing(false);

    // Auto-speak with selected ElevenLabs voice (latest values via ref)
    if (autoSpeakRef.current && selectedVoiceRef.current) {
      // Small delay so UI updates first
      setTimeout(() => speak(text), 120);
    }
  };

  const quickReplies = [
    'Je veux prendre un rendez-vous',
    'Demain',
    '14h30',
    'Oui, c\'est correct',
    'Merci, au revoir',
  ];

  const selectedVoiceName = voices.find(v => v.id === selectedVoice)?.name || 'Default';

  return (
    <div style={{ minHeight: '100vh', background: '#1a1208', padding: 40 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: 32, 
          fontWeight: 700, 
          color: '#c8a96e',
          marginBottom: 8,
          fontFamily: "'Cal Sans', sans-serif"
        }}>
          Démo Agent Vocal AI
        </h1>
        <p style={{ color: '#a08060', marginBottom: 24 }}>
          Simulez une conversation avec l'agent vocal Planxo
        </p>

        {/* Status Bar */}
        <div style={{
          background: 'rgba(200,169,110,0.1)',
          border: '1px solid rgba(200,169,110,0.2)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ color: '#80604a', fontSize: 13 }}>État: </span>
            <span style={{ color: '#c8a96e', fontWeight: 600, textTransform: 'capitalize' }}>{state}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: isProcessing ? '#f59e0b' : '#10b981',
              animation: isProcessing ? 'pulse 1s infinite' : 'none'
            }} />
            <span style={{ color: '#80604a', fontSize: 13 }}>
              {isProcessing ? 'Traitement...' : 'Prêt'}
            </span>
          </div>
        </div>

        {/* ElevenLabs Voice Selector */}
        <div style={{
          background: 'rgba(200,169,110,0.06)',
          border: '1px solid rgba(200,169,110,0.15)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>🔊</span>
              <span style={{ color: '#c8a96e', fontWeight: 600, fontSize: 14 }}>Voix ElevenLabs</span>
              {isSpeaking && (
                <span style={{ 
                  fontSize: 12, 
                  background: 'rgba(16,185,129,0.2)', 
                  color: '#10b981', 
                  padding: '2px 8px', 
                  borderRadius: 999,
                  fontWeight: 600
                }}>
                  EN COURS DE PAROLE
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#a08060' }}>
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                  style={{ accentColor: '#c8a96e' }}
                />
                Auto-parler
              </label>
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.4)',
                    background: 'transparent',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ⏹ Arrêter
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedVoice}
              onChange={(e) => {
                const newVoice = e.target.value;
                setSelectedVoice(newVoice);
                // Preview the new voice with a short sample
                if (newVoice) {
                  stopSpeaking();
                  setTimeout(() => speak("Bonjour, je suis votre assistant vocal Planxo. Comment puis-je vous aider aujourd'hui?"), 80);
                }
              }}
              disabled={voices.length === 0 || isSpeaking}
              style={{
                flex: 1,
                minWidth: 220,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid rgba(200,169,110,0.3)',
                background: '#0f0a05',
                color: '#f5ead8',
                fontSize: 14,
                cursor: isSpeaking ? 'not-allowed' : 'pointer',
              }}
            >
              {voices.length === 0 && <option>Chargement des voix...</option>}
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} {voice.labels?.accent ? `· ${voice.labels.accent}` : ''}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                if (selectedVoice) {
                  stopSpeaking();
                  speak("Bonjour ! Je suis l'assistant vocal de Planxo. Je peux vous aider à réserver un rendez-vous.");
                }
              }}
              disabled={!selectedVoice || isSpeaking}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(200,169,110,0.3)',
                background: 'transparent',
                color: '#c8a96e',
                fontSize: 13,
                cursor: (!selectedVoice || isSpeaking) ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              ▶ Tester la voix
            </button>
          </div>

          {voiceError && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>
              ⚠️ {voiceError}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 11, color: '#80604a' }}>
            Réponses parlées avec <strong>{selectedVoiceName}</strong> via ElevenLabs
          </div>
        </div>

        {/* Chat Window */}
        <div style={{
          background: '#0f0a05',
          border: '1px solid rgba(200,169,110,0.15)',
          borderRadius: 16,
          height: 500,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#604830', padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎙️</div>
                <p>La conversation va commencer...</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: msg.role === 'user' 
                    ? 'rgba(200,169,110,0.2)' 
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${msg.role === 'user' 
                    ? 'rgba(200,169,110,0.3)' 
                    : 'rgba(200,169,110,0.1)'}`,
                  borderRadius: 12,
                  padding: '12px 16px',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 12,
                }}
              >
                <div style={{ 
                  fontSize: 11, 
                  color: msg.role === 'user' ? '#c8a96e' : '#80604a',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  {msg.role === 'user' ? 'Vous' : 'Agent Planxo'}
                </div>
                <div style={{ color: '#f5ead8', lineHeight: 1.5 }}>{msg.text}</div>
                <div style={{ fontSize: 11, color: '#604830', marginTop: 4 }}>
                  {msg.timestamp.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(200,169,110,0.1)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(reply);
                  handleSendMessage(reply);
                  setInputText('');
                }}
                disabled={isProcessing}
                style={{
                  padding: '6px 12px',
                  borderRadius: 16,
                  border: '1px solid rgba(200,169,110,0.2)',
                  background: 'transparent',
                  color: '#a08060',
                  fontSize: 13,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  opacity: isProcessing ? 0.5 : 1,
                }}
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Input */}
          <form 
            onSubmit={handleSubmit}
            style={{
              padding: 16,
              borderTop: '1px solid rgba(200,169,110,0.1)',
              display: 'flex',
              gap: 12,
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tapez votre message..."
              disabled={isProcessing}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(200,169,110,0.2)',
                background: 'rgba(255,255,255,0.03)',
                color: '#f5ead8',
                fontSize: 15,
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isProcessing || !inputText.trim()}
              style={{
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #c8a96e, #a07840)',
                color: '#1a1208',
                fontWeight: 600,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !inputText.trim() ? 0.5 : 1,
              }}
            >
              Envoyer
            </button>
          </form>
        </div>

        {/* Context Debug */}
        {Object.keys(context).length > 0 && (
          <div style={{
            marginTop: 20,
            padding: 16,
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 12,
            border: '1px solid rgba(200,169,110,0.1)',
          }}>
            <div style={{ fontSize: 12, color: '#80604a', marginBottom: 8 }}>
              Contexte de la conversation:
            </div>
            <pre style={{ 
              margin: 0, 
              fontSize: 12, 
              color: '#a08060',
              overflow: 'auto'
            }}>
              {JSON.stringify(context, null, 2)}
            </pre>
          </div>
        )}

        {/* Instructions */}
        <div style={{
          marginTop: 24,
          padding: 20,
          background: 'rgba(200,169,110,0.05)',
          borderRadius: 12,
          border: '1px solid rgba(200,169,110,0.1)',
        }}>
          <h3 style={{ color: '#c8a96e', fontSize: 16, marginBottom: 12 }}>
            Comment tester:
          </h3>
          <ol style={{ color: '#a08060', fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
            <li>L'agent commence avec une salutation (parlée avec ElevenLabs)</li>
            <li>Dites que vous voulez prendre un rendez-vous</li>
            <li>Donnez votre nom et email</li>
            <li>Choisissez une date (ex: "demain", "vendredi", "15 juin") — l'agent vérifie les vrais créneaux</li>
            <li>Choisissez une heure (ex: "14h30", "2 heures")</li>
            <li>Confirmez — le rendez-vous est réellement créé via Planxo !</li>
          </ol>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
