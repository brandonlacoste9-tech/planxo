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
  // Cognac + Gold color palette (matching Planxo branding)
  const COLORS = {
    bg: '#1a1208',
    cardBg: '#0f0a05',
    gold: '#c8a96e',
    goldDark: '#a07840',
    text: '#f5ead8',
    textMuted: '#a08060',
    textDarkMuted: '#80604a',
    border: 'rgba(200,169,110,0.2)',
    red: '#ef4444',
    green: '#10b981',
  };
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
  const [lastAssistantText, setLastAssistantText] = useState('');
  const [hasSpokenInitial, setHasSpokenInitial] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);           // React-controlled audio element
  const currentAudioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAudioErrorRef = useRef<number>(0);

  // Refs to avoid stale closures in callbacks
  const isListeningRef = useRef(isListening);
  const continuousModeRef = useRef(continuousMode);
  const isProcessingRef = useRef(isProcessing);

  isListeningRef.current = isListening;
  continuousModeRef.current = continuousMode;
  isProcessingRef.current = isProcessing;

  // === Speech Recognition Instance Management (for fast + reliable language switching) ===
  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return null;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = selectedLang;

      rec.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) final = transcript;
          else interim = transcript;
        }
        setInterimTranscript(interim);

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (isListeningRef.current) stopListening();
        }, 2600);

        if (final.trim()) {
          setInterimTranscript('');
          if (!continuousModeRef.current) stopListening();
          handleSendMessage(final.trim());
        }
      };

      rec.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setSpeechError(
            event.error === 'not-allowed'
              ? 'Please allow microphone access.'
              : 'Speech recognition error.'
          );
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      };

      return rec;
    } catch (e) {
      console.error('Failed to create SpeechRecognition', e);
      return null;
    }
  }, [selectedLang]);

  // Recreate recognition when language changes (ensures correct lang)
  useEffect(() => {
    // Directly abort instead of calling stopListening (avoids dependency issues)
    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    } catch {}

    recognitionRef.current = createRecognition();

    // If we were listening, the old instance is dead — user will need to click mic again
    // This is safer than trying to auto-restart during language change
    setIsListening(false);
    isListeningRef.current = false;
  }, [selectedLang, createRecognition]);

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

  // Speak the first message (or pending message) once we have a voice selected
  useEffect(() => {
    if (selectedVoice && lastAssistantText && !hasSpokenInitial) {
      speak(lastAssistantText);
      setHasSpokenInitial(true);
    }
  }, [selectedVoice, lastAssistantText]);

  // === TTS ===
  const getTTSLanguage = (langCode: string): 'fr' | 'en' => langCode.startsWith('fr') ? 'fr' : 'en';

  const stopSpeaking = useCallback(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.currentTime = 0;
        // Clear src to help browser release resources cleanly
        audioEl.src = '';
      } catch (e) {
        console.warn('Audio stop warning:', e);
      }
    }
    if (currentAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      } catch {}
      currentAudioUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    if (!selectedVoice || !text.trim()) return;

    const audioEl = audioRef.current;
    if (!audioEl) {
      console.warn('Audio element not ready yet');
      return;
    }

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

      // Use the React-managed <audio> element instead of new Audio()
      // This dramatically reduces "removeChild" / DOM lifecycle crashes
      audioEl.src = url;
      audioEl.volume = volume;

      const handleEnded = () => {
        setIsSpeaking(false);

        if (currentAudioUrlRef.current) {
          try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch {}
          currentAudioUrlRef.current = null;
        }

        audioEl.onended = null; // prevent duplicate handlers

        // Continuous mode — but skip auto-restart right after an audio error (prevents cascading crashes)
        const timeSinceAudioError = Date.now() - lastAudioErrorRef.current;
        if (continuousModeRef.current && 
            !isListeningRef.current && 
            !isProcessingRef.current &&
            recognitionRef.current &&
            timeSinceAudioError > 4000) {
          setTimeout(() => {
            if (!isListeningRef.current && !isProcessingRef.current) {
              startListening();
            }
          }, 650);
        }
      };

      audioEl.onended = handleEnded;

      await audioEl.play().catch((playErr) => {
        // Some browsers block autoplay even after user gesture in edge cases
        console.warn('Audio play() was blocked or failed:', playErr);
        throw playErr; // let the outer catch handle cleanup
      });
    } catch (err: any) {
      console.error('Speak error (ElevenLabs TTS):', err);
      setIsSpeaking(false);

      // Always clean up the object URL on any failure
      if (currentAudioUrlRef.current) {
        try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch {}
        currentAudioUrlRef.current = null;
      }

      // Reset the audio element to a clean state
      if (audioEl) {
        try {
          audioEl.src = '';
          audioEl.onended = null;
        } catch {}
      }

      if (err.message?.includes('quota') || err.message?.includes('429')) {
        setSpeechError('ElevenLabs quota reached for this voice. Try another voice or wait a bit.');
      } else if (err.name === 'NotAllowedError' || String(err).includes('play')) {
        setSpeechError('Browser blocked audio playback. Click the mic or page once to enable sound.');
      } else {
        setSpeechError('Could not generate voice. The AI will continue in text only for now.');
      }
      setTimeout(() => setSpeechError(''), 5000);
    }
  }, [selectedVoice, selectedLang, volume, mode, stopSpeaking]);

  // === Fast & reliable startListening (with extra guards) ===
  const startListening = useCallback(() => {
    if (isListeningRef.current || isProcessingRef.current) {
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }

    if (!recognitionRef.current) {
      setSpeechError('Microphone not supported in this browser (Chrome/Edge recommended).');
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    try {
      stopSpeaking();
      setSpeechError('');
      setInterimTranscript('');

      // Always set lang immediately before start
      recognitionRef.current.lang = selectedLang;

      recognitionRef.current.start();

      setIsListening(true);
      isListeningRef.current = true;
    } catch (e: any) {
      console.error('Error starting SpeechRecognition:', e);

      // Handle the very common "already started" error gracefully
      if (String(e?.message || e).toLowerCase().includes('already started')) {
        try { recognitionRef.current?.abort(); } catch {}
        setIsListening(false);
        isListeningRef.current = false;
      } else {
        setSpeechError('Could not start microphone. Please try again.');
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [selectedLang, createRecognition, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    } catch (e) {
      // Swallow abort errors — they are common and not fatal
      console.warn('SpeechRecognition abort warning (non-critical):', e);
    }

    setIsListening(false);
    setInterimTranscript('');
    isListeningRef.current = false;
  }, []);

  const toggleListening = useCallback(() => {
    if (isProcessingRef.current) return;

    if (isListeningRef.current) {
      stopListening();
    } else {
      // Optimistic update for instant perceived speed
      setIsListening(true);
      isListeningRef.current = true;

      // Tiny delay so the browser has time to paint the "Listening" state
      setTimeout(() => {
        startListening();
      }, 25);
    }
  }, [startListening, stopListening]);

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
    setLastAssistantText(text);

    // Only speak if we have a voice selected (prevents silent first greeting)
    if (selectedVoice) {
      speak(text);
    } else {
      // Will speak automatically once a voice is chosen (see useEffect below)
      console.log('[VoiceAgent] Waiting for voice selection before speaking...');
    }
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
        padding: 12, background: COLORS.cardBg, borderRadius: 12, alignItems: 'center',
        border: `1px solid ${COLORS.border}`
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
          marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, 
          border: `1px solid ${COLORS.gold}`,
          background: COLORS.cardBg, 
          color: COLORS.gold,
          cursor: 'pointer', 
          fontSize: 13
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

        <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textDarkMuted }}>
          {isListening ? 'Listening… (or press Space)' : 'Press Space to talk • I to interrupt'}
        </div>
      </div>

      {/* Quick voice commands */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
        {[
          'Je veux prendre un rendez-vous',
          'Demain à 14h30',
          'Quel est votre nom?',
          'Oui c\'est correct',
          'Non, pas cette heure'
        ].map((phrase, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(phrase)}
            disabled={isProcessing || isListening}
            style={{
              fontSize: 12,
              padding: '5px 11px',
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: 'transparent',
              color: COLORS.gold,
              cursor: 'pointer',
              opacity: isProcessing ? 0.5 : 1
            }}
          >
            {phrase}
          </button>
        ))}
      </div>

      {/* Interrupt + Status */}
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        {(isSpeaking || isListening) ? (
          <button onClick={interrupt} style={{
            padding: '8px 20px', 
            background: '#3f1f1f', 
            color: COLORS.red, 
            border: `1px solid ${COLORS.red}`,
            borderRadius: 999, 
            fontWeight: 600, 
            cursor: 'pointer'
          }}>
            ⏹ Stop {isSpeaking ? 'speaking' : 'listening'}
          </button>
        ) : lastAssistantText ? (
          <button 
            onClick={() => speak(lastAssistantText)} 
            disabled={!selectedVoice || isProcessing}
            style={{
              padding: '6px 16px',
              background: 'transparent',
              color: COLORS.gold,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 999,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            🔊 Replay last response
          </button>
        ) : null}
      </div>

      {/* Speaking indicator */}
      {isSpeaking && (
        <div style={{ 
          textAlign: 'center', 
          color: COLORS.gold, 
          fontSize: 13, 
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8
        }}>
          <span style={{ animation: 'pulse 1.2s infinite' }}>🔊</span> 
          Speaking with {selectedVoiceName || 'ElevenLabs'}...
        </div>
      )}

      {/* Live interim + errors */}
      {interimTranscript && (
        <div style={{ textAlign: 'center', marginBottom: 12, fontStyle: 'italic', color: COLORS.gold }}>
          You: “{interimTranscript}”
        </div>
      )}
      {speechError && <div style={{ color: '#dc2626', textAlign: 'center', marginBottom: 12 }}>{speechError}</div>}

      {/* Conversation */}
      <div style={{
        border: `1px solid ${COLORS.border}`, borderRadius: 16, minHeight: 280, maxHeight: 420,
        overflowY: 'auto', padding: 20, background: COLORS.cardBg, marginBottom: 12
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
              background: msg.role === 'user' ? COLORS.gold : COLORS.bg,
              color: msg.role === 'user' ? COLORS.bg : COLORS.text,
              border: msg.role === 'assistant' ? `1px solid ${COLORS.border}` : 'none'
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
            border: `1px solid ${COLORS.border}`,
            background: COLORS.cardBg,
            color: COLORS.text,
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

      {/* React-managed <audio> element — this is the main defense against removeChild crashes */}
      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onError={(e) => {
          console.error('[VoiceAgent] Audio element error', e);
          setIsSpeaking(false);
          lastAudioErrorRef.current = Date.now();

          // Aggressive cleanup on audio errors to prevent DOM reconciliation crashes
          const audioEl = audioRef.current;
          if (audioEl) {
            try {
              audioEl.src = '';
              audioEl.onended = null;
              audioEl.load();
            } catch {}
          }
          if (currentAudioUrlRef.current) {
            try { URL.revokeObjectURL(currentAudioUrlRef.current); } catch {}
            currentAudioUrlRef.current = null;
          }
        }}
      />
    </div>
  );
}
