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

    conversationRef.current = new ConversationManager(session, {
      onStateChange: (newState) => {
        setState(newState);
      },
      onResponse: (text) => {
        setMessages(prev => [...prev, { role: 'assistant', text, timestamp: new Date() }]);
        setIsProcessing(false);
      },
    });

    // Send initial greeting
    conversationRef.current.generateGreeting();

    return () => {
      conversationRef.current = null;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string, isInitial = false) => {
    if (!conversationRef.current || isProcessing) return;
    
    setIsProcessing(true);
    
    if (!isInitial && text.trim()) {
      setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);
    }

    try {
      const response = await conversationRef.current.processUserInput(text);
      if (isInitial) {
        setMessages(prev => [...prev, { role: 'assistant', text: response, timestamp: new Date() }]);
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

  const quickReplies = [
    'Je veux prendre un rendez-vous',
    'Demain',
    '14h30',
    'Oui, c\'est correct',
    'Merci, au revoir',
  ];

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
          marginBottom: 20,
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
            <li>L'agent commence avec une salutation</li>
            <li>Dites que vous voulez prendre un rendez-vous</li>
            <li>Donnez votre nom et email</li>
            <li>Choisissez une date (ex: "demain", "vendredi", "15 juin")</li>
            <li>Choisissez une heure (ex: "14h30", "2 heures")</li>
            <li>Confirmez la réservation</li>
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
