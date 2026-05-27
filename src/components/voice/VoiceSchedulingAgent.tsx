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

  // Safe mode: automatically disables Continuous Mode after the first audio error
  const [safeModeActive, setSafeModeActive] = useState(false);

  // Global safe rendering mode - when true, we heavily throttle interactions and avoid risky operations
  // to recover from DOM corruption (especially caused by extensions like Google Translate)
  const [ultraSafeMode, setUltraSafeMode] = useState(false);

  // Mount guard to prevent speaking too early during initial render / extension interference
  const isMountedRef = useRef(false);

  // Track if the user has manually used the mic at least once.
  const hasUserStartedVoiceRef = useRef(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);           // React-controlled audio element
  const currentAudioUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAudioErrorRef = useRef<number>(0);
  const hasHadAudioErrorRef = useRef(false);

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
      rec.maxAlternatives = 3; // Allow more alternatives for better matching
      rec.lang = selectedLang;

      rec.onresult = (event: any) => {
        try {
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
          }, 3500); // Increased silence timeout to prevent cutting off user

          if (final.trim()) {
            setInterimTranscript('');
            if (!continuousModeRef.current) stopListening();
            handleSendMessage(final.trim());
          }
        } catch (err) {
          console.error('[VoiceAgent] Error in onresult handler:', err);
          // If we get repeated errors in handlers, enter ultra safe mode
          setUltraSafeMode(true);
          setIsListening(false);
        }
      };

      rec.onerror = (event: any) => {
        try {
          if (event.error !== 'no-speech') {
            setSpeechError(
              event.error === 'not-allowed'
                ? 'Please allow microphone access.'
                : 'Speech recognition error.'
            );
          }
          setIsListening(false);
        } catch (err) {
          console.error('[VoiceAgent] Error in onerror handler:', err);
          setUltraSafeMode(true);
          setIsListening(false);
        }
      };

      rec.onend = () => {
        try {
          setIsListening(false);
          setInterimTranscript('');
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        } catch (err) {
          console.error('[VoiceAgent] Error in onend handler:', err);
          setUltraSafeMode(true);
          setIsListening(false);
        }
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
      const data = await res.json();
      if (!res.ok) {
        console.error('[VoiceAgent] Voices API error:', res.status, data?.error);
        setSpeechError(`Could not load voices (${res.status}: ${data?.error || 'unknown'}). Check ELEVENLABS_API_KEY in Vercel env vars.`);
        return;
      }
      if (data.voices?.length) {
        setVoices(data.voices);
        setSelectedVoice(data.voices[0].id);
      } else {
        console.warn('[VoiceAgent] Voices API returned empty list', data);
        setSpeechError('No voices returned from ElevenLabs. Check your API key and account.');
      }
    } catch (e) {
      console.error('[VoiceAgent] Failed to load voices:', e);
      setSpeechError('Network error loading voices. Check your connection.');
    } finally {
      setIsLoadingVoices(false);
    }
  }, [mode]);

  // Initial setup
  useEffect(() => {
    isMountedRef.current = true;
    initConversation();
    loadVoices();
    return () => {
      isMountedRef.current = false;
      stopSpeaking();
      stopListening();
      if (conversationRef.current) conversationRef.current = null;
    };
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // Speak the first message ONLY after the user has manually used the mic at least once.
  // The very first greeting is deliberately text-only and is NEVER auto-spoken via audio.
  // Speaking only begins for messages that arrive after the user has clicked the microphone at least once.
  //
  // This is currently the strongest protection against the early "removeChild" crashes that occur during
  // the initial mount when browser extensions (especially Google Translate) are actively modifying the DOM.
  useEffect(() => {
    if (!isMountedRef.current) return;

    // Only speak assistant responses that come *after* the user has manually started a voice interaction.
    if (selectedVoice && lastAssistantText && !hasSpokenInitial && hasUserStartedVoiceRef.current) {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          speak(lastAssistantText);
          setHasSpokenInitial(true);
        }
      }, 100);
      return () => clearTimeout(timer);
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
        // Be very conservative: avoid clearing src during hot paths to prevent removeChild crashes
        // The next speak() will overwrite src anyway
      } catch (e) {
        console.warn('Audio stop warning (non-fatal):', e);
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
    if (!isMountedRef.current) return;
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

        // Clear handler to avoid duplicates
        try { audioEl.onended = null; } catch {}

        // Continuous mode restart is now very conservative after any audio activity
        const timeSinceAudioError = Date.now() - lastAudioErrorRef.current;
        if (continuousModeRef.current && 
            !isListeningRef.current && 
            !isProcessingRef.current &&
            recognitionRef.current &&
            timeSinceAudioError > 5000) {   // longer cooldown
          setTimeout(() => {
            if (!isListeningRef.current && !isProcessingRef.current) {
              startListening();
            }
          }, 800); // slightly longer delay
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
    if (ultraSafeMode) {
      setSpeechError('Safe mode active due to previous issues. Please refresh the page.');
      return;
    }
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

      hasUserStartedVoiceRef.current = true;

      recognitionRef.current.lang = selectedLang;
      recognitionRef.current.start();

      setIsListening(true);
      isListeningRef.current = true;
    } catch (e: any) {
      console.error('Error starting SpeechRecognition:', e);

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
  }, [selectedLang, createRecognition, stopSpeaking, ultraSafeMode]);

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
      if (ultraSafeMode) {
        setSpeechError('Safe mode active. Please refresh the page to use the microphone again.');
        return;
      }

      // Optimistic update for instant perceived speed
      setIsListening(true);
      isListeningRef.current = true;

      hasUserStartedVoiceRef.current = true;

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
    <div className={`voice-agent ${className}`} style={{ fontFamily: 'system-ui, sans-serif' }} translate="no">
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

        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6, 
          fontSize: 13,
          opacity: safeModeActive ? 0.6 : 1,
          cursor: safeModeActive ? 'not-allowed' : 'pointer'
        }}>
          <input 
            type="checkbox" 
            checked={continuousMode} 
            onChange={e => setContinuousMode(e.target.checked)}
            disabled={safeModeActive}
          />
          Continuous mode
          {safeModeActive && (
            <span style={{ 
              fontSize: 11, 
              color: '#ef4444',
              marginLeft: 4,
              whiteSpace: 'nowrap'
            }}>
              (safe mode)
            </span>
          )}
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

      {/* Safe Mode notice */}
      {safeModeActive && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          marginBottom: 12,
          textAlign: 'center'
        }}>
          ⚠️ Safe mode activated — Continuous mode has been disabled after an audio playback issue. 
          You can still use the mic manually.
        </div>
      )}

      {/* Ultra Safe Mode - triggered by repeated internal errors (often extension interference) */}
      {ultraSafeMode && (
        <div style={{
          background: '#3f1f1f',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          <strong>Ultra Safe Mode active</strong><br />
          The voice agent encountered repeated internal errors (commonly caused by browser extensions like Google Translate).<br />
          Please refresh the page for best results.
        </div>
      )}

      {/* Main Mic Button + Visualizer */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <button
          onClick={toggleListening}
          disabled={isProcessing || isSpeaking || !selectedVoice || ultraSafeMode}
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
          {isListening 
            ? 'Listening… (or press Space)' 
            : 'Click the mic to begin — the opening greeting is text-only (no audio on first load)'}
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
          <span translate="no">Speaking with {selectedVoiceName || 'ElevenLabs'}...</span>
        </div>
      )}

      {/* Live interim + errors */}
      {interimTranscript && (
        <div style={{ textAlign: 'center', marginBottom: 12, fontStyle: 'italic', color: COLORS.gold }} translate="no">
          You: “{interimTranscript}”
        </div>
      )}
      {speechError && <div style={{ color: '#dc2626', textAlign: 'center', marginBottom: 12 }} translate="no">{speechError}</div>}

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
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }} translate="no">
                {msg.role === 'user' ? 'You' : professionalName}
              </div>
              <span translate="no">{msg.text}</span>
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

          // Activate safe mode on first audio error (disables Continuous Mode for the rest of the session)
          if (!hasHadAudioErrorRef.current) {
            hasHadAudioErrorRef.current = true;
            setSafeModeActive(true);
            setContinuousMode(false); // Force disable Continuous Mode
          }

          // Very passive cleanup — avoid .load() or heavy DOM ops that can trigger more errors / removeChild issues
          const audioEl = audioRef.current;
          if (audioEl) {
            try {
              audioEl.onended = null;
              // Do not set src='' or call load() here — it often causes repeated error events and DOM conflicts
              // The next speak() or stopSpeaking() will handle src assignment
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
