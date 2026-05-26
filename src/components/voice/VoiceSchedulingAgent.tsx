'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ConversationManager, AITools } from '@/lib/voice/conversation';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoiceSchedulingAgentProps {
  mode: 'demo' | 'dashboard';
  professionalName?: string;
  username?: string;
  eventTypeSlug?: string;
  defaultLanguage?: string;
  showTranscript?: boolean;
  className?: string;
}

const LANGUAGES = [
  { code: 'fr-CA', label: 'Français (Québec)' },
  { code: 'fr-FR', label: 'Français (France)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-CA', label: 'English (Canada)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'de-DE', label: 'Deutsch' },
];

export function VoiceSchedulingAgent({
  mode,
  professionalName = mode === 'demo' ? 'Dr. Sarah Martin' : 'Votre pratique',
  username = 'planxo',
  eventTypeSlug = 'appel-de-decouverte',
  defaultLanguage = 'fr-CA',
  showTranscript = true,
  className = '',
}: VoiceSchedulingAgentProps) {
  // Core conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<string>('greeting');
  const [isProcessing, setIsProcessing] = useState(false);
  const conversationRef = useRef<ConversationManager | null>(null);

  // Voice settings
  const [voices, setVoices] = useState<any[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [selectedLang, setSelectedLang] = useState(defaultLanguage);
  const [volume, setVolume] = useState(0.9);
  const [continuousMode, setContinuousMode] = useState(true);

  // Real-time UI state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speechError, setSpeechError] = useState('');
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tools configuration
  const getTools = useCallback((): AITools => ({
    checkAvailability: async (date: string) => {
      const url = mode === 'dashboard' 
        ? `/api/v2/ai/availability?date=${date}&username=${username}&eventTypeSlug=${eventTypeSlug}`
        : `/api/v2/ai/availability?date=${date}`;
      const res = await fetch(url);
      if (!res.ok) return { availableTimes: [] };
      const data = await res.json();
      return { availableTimes: data.availableTimes || [], rawSlots: data.rawSlots };
    },
    createBooking: async (params) => {
      const res = await fetch('/api/v2/ai/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: params.name,
          email: params.email,
          start: params.start,
          username,
          eventTypeSlug,
        }),
      });
      const data = await res.json();
      return { success: !!data.success, message: data.message || data.error, booking: data.booking };
    },
  }), [mode, username, eventTypeSlug]);

  // Initialize conversation manager
  const initConversation = useCallback(() => {
    const session = {
      callSid: `${mode}-${Date.now()}`,
      userId: mode === 'dashboard' ? 'dashboard-user' : 'demo-user',
      state: 'greeting' as const,
      context: { professionalName },
      startTime: new Date(),
      audioBuffer: [],
      transcript: [],
    };

    conversationRef.current = new ConversationManager(session, {
      onStateChange: (newState) => setState(newState),
      onResponse: (text) => handleAssistantResponse(text),
    }, getTools());

    conversationRef.current.generateGreeting();
  }, [mode, professionalName, getTools]);

  // Load voices (authenticated vs public demo routes)
  const loadVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    const route = mode === 'dashboard' ? '/api/v2/elevenlabs/voices' : '/api/demo/elevenlabs/voices';
    try {
      const res = await fetch(route);
      if (res.ok) {
        const data = await res.json();
        if (data.voices?.length) {
          setVoices(data.voices);
          if (!selectedVoice) {
            setSelectedVoice(data.voices[0].id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load voices', e);
    } finally {
      setIsLoadingVoices(false);
    }
  }, [mode, selectedVoice]);

  // Initial setup
  useEffect(() => {
    initConversation();
    loadVoices();
    return () => {
      stopSpeaking();
      stopListening();
      if (conversationRef.current) conversationRef.current = null;
    };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // === TTS ===
  const getTTSLanguage = (langCode: string): 'fr' | 'en' => langCode.startsWith('fr') ? 'fr' : 'en';

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!selectedVoice || !text.trim()) return;

    stopSpeaking();
    setIsSpeaking(true);

    const route = mode === 'dashboard' ? '/api/v2/elevenlabs/tts' : '/api/demo/elevenlabs/tts';

    try {
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voiceId: selectedVoice,
          language: getTTSLanguage(selectedLang),
        }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      currentAudioUrlRef.current = url;

      const audio = new Audio(url);
      audio.volume = volume;
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
        // Continuous mode
        if (continuousMode && !isListening && !isProcessing) {
          setTimeout(() => startListening(), 620);
        }
      };

      await audio.play();
    } catch (err) {
      console.error('Speak error:', err);
      setIsSpeaking(false);
    }
  }, [selectedVoice, selectedLang, volume, continuousMode, mode, isListening, isProcessing, stopSpeaking]);

  // === Speech Recognition with advanced VAD ===
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Microphone not supported in this browser. Use Chrome or Edge.');
      return;
    }

    stopSpeaking();
    setSpeechError('');
    setInterimTranscript('');

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final = transcript;
          else interim = transcript;
        }
        setInterimTranscript(interim);

        // Reset silence timer on any activity
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (isListening) stopListening();
        }, 2750);

        if (final.trim()) {
          setInterimTranscript('');
          if (!continuousMode) stopListening();
          handleSendMessage(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setSpeechError(event.error === 'not-allowed' ? 'Please allow microphone access.' : 'Speech recognition error.');
        }
        stopListening();
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.lang = selectedLang;
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      setSpeechError('Could not start microphone.');
      setIsListening(false);
    }
  }, [selectedLang, continuousMode, stopSpeaking, isListening]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const toggleListening = useCallback(() => {
    isListening ? stopListening() : startListening();
  }, [isListening, startListening, stopListening]);

  // === Core message handling ===
  const handleSendMessage = async (text: string) => {
    if (!conversationRef.current || isProcessing) return;

    stopListening();
    stopSpeaking();
    setIsProcessing(true);

    setMessages(prev => [...prev, { role: 'user', text, timestamp: new Date() }]);

    try {
      await conversationRef.current.processUserInput(text);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssistantResponse = (text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', text, timestamp: new Date() }]);
    setIsProcessing(false);
    speak(text);
  };

  // === Controls ===
  const interrupt = () => {
    stopSpeaking();
    stopListening();
  };

  const resetConversation = () => {
    stopSpeaking();
    stopListening();
    setMessages([]);
    setInterimTranscript('');
    setState('greeting');
    setSpeechError('');
    initConversation();
  };

  // Volume control
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Keyboard support: Hold Space to talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isListening && !isProcessing && !isSpeaking) {
        e.preventDefault();
        startListening();
      }
      if (e.key.toLowerCase() === 'i' && (isSpeaking || isListening)) {
        interrupt();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isListening) {
        e.preventDefault();
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isListening, isProcessing, isSpeaking, startListening, stopListening]);

  const selectedVoiceName = voices.find(v => v.id === selectedVoice)?.name || '';

  return (
    <div className={`voice-agent ${className}`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16,
        padding: 12, background: '#f8f5f0', borderRadius: 12, alignItems: 'center'
      }}>
        <div>
          <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} disabled={isListening || isProcessing}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d4c7a8' }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <div>
          <select value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)} disabled={isLoadingVoices || isListening || isProcessing}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d4c7a8', minWidth: 180 }}>
            {isLoadingVoices && <option>Loading voices...</option>}
            {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={continuousMode} onChange={e => setContinuousMode(e.target.checked)} />
          Continuous mode
        </label>

        {/* Volume */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span>🔊</span>
          <input type="range" min={0.1} max={1} step={0.05} value={volume}
            onChange={e => setVolume(parseFloat(e.target.value))} style={{ width: 90 }} />
          <span style={{ width: 28, textAlign: 'right' }}>{Math.round(volume * 100)}%</span>
        </div>

        <button onClick={resetConversation} style={{
          marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid #c8a96e',
          background: 'white', cursor: 'pointer', fontSize: 13
        }}>
          ⟳ New conversation
        </button>
      </div>

      {/* Main Mic Button + Visualizer */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          onClick={toggleListening}
          disabled={isProcessing || isSpeaking || !selectedVoice}
          style={{
            padding: '18px 36px',
            fontSize: 18,
            fontWeight: 700,
            borderRadius: 999,
            border: 'none',
            background: isListening ? '#dc2626' : '#c8a96e',
            color: isListening ? 'white' : '#1a1208',
            cursor: (isProcessing || isSpeaking) ? 'not-allowed' : 'pointer',
            minWidth: 260,
            boxShadow: isListening ? '0 0 0 8px rgba(220,38,38,0.15)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {isListening ? '⏹ Release to stop' : '🎤 Hold or click to speak'}
        </button>

        <div style={{ marginTop: 8, fontSize: 12, color: '#80604a' }}>
          {isListening ? 'Listening… (or press Space)' : 'Press Space to talk • I to interrupt'}
        </div>
      </div>

      {/* Interrupt + Status */}
      {(isSpeaking || isListening) && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button onClick={interrupt} style={{
            padding: '8px 20px', background: '#fee2e2', color: '#b91c1c', border: 'none',
            borderRadius: 999, fontWeight: 600, cursor: 'pointer'
          }}>
            ⏹ Stop speaking / listening
          </button>
        </div>
      )}

      {/* Live interim + errors */}
      {interimTranscript && (
        <div style={{ textAlign: 'center', marginBottom: 12, fontStyle: 'italic', color: '#c8a96e' }}>
          You: “{interimTranscript}”
        </div>
      )}
      {speechError && <div style={{ color: '#dc2626', textAlign: 'center', marginBottom: 12 }}>{speechError}</div>}

      {/* Conversation */}
      <div style={{
        border: '1px solid #e5d9c2', borderRadius: 16, minHeight: 280, maxHeight: 420,
        overflowY: 'auto', padding: 20, background: '#fdfaf3', marginBottom: 12
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#a08060', paddingTop: 40 }}>
            Start speaking or click the mic button above.
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: 14,
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '82%',
              padding: '10px 16px',
              borderRadius: 14,
              background: msg.role === 'user' ? '#c8a96e' : '#fff',
              color: msg.role === 'user' ? '#1a1208' : '#222',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
                {msg.role === 'user' ? 'You' : professionalName}
              </div>
              {msg.text}
            </div>
          </div>
        ))}
        {isProcessing && <div style={{ color: '#a08060', fontStyle: 'italic' }}>Agent is thinking…</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* Status line */}
      <div style={{ fontSize: 12, color: '#80604a', display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>Status: <strong>{state}</strong></div>
        {selectedVoiceName && <div>Voice: {selectedVoiceName}</div>}
      </div>

      {/* Text fallback input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const input = form.elements.namedItem('textInput') as HTMLInputElement;
          if (input?.value.trim()) {
            handleSendMessage(input.value.trim());
            input.value = '';
          }
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          name="textInput"
          type="text"
          placeholder="Ou tapez ici..."
          disabled={isProcessing || isListening}
          style={{
            flex: 1,
            padding: '11px 14px',
            borderRadius: 10,
            border: '1px solid #d4c7a8',
            background: '#fff',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={isProcessing || isListening}
          style={{
            padding: '0 20px',
            borderRadius: 10,
            border: '1px solid #c8a96e',
            background: '#c8a96e',
            color: '#1a1208',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
