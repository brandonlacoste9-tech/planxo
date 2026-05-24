// WebSocket streaming server using Socket.io pattern
// For Next.js, we use a separate WebSocket server

import { createServer } from 'http';
import { Server } from 'socket.io';
import { CallSession } from '../../../lib/voice/types';
import { ConversationManager } from '../../../lib/voice/conversation';
import { DeepgramSTT } from '../../../lib/voice/deepgram';
import { ElevenLabsTTS } from '../../../lib/voice/elevenlabs';

// This runs as a separate WebSocket server
// In production, this would be a separate service or use a managed WebSocket provider

const activeSessions = new Map<string, CallSession>();

export function initWebSocketServer(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    path: '/api/voice/stream',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('[Socket.io] Client connected:', socket.id);
    
    let session: CallSession | null = null;
    let conversationManager: ConversationManager | null = null;
    let deepgram: DeepgramSTT | null = null;
    let elevenLabs: ElevenLabsTTS | null = null;

    socket.on('start', async (data: { 
      callSid: string; 
      userId: string; 
      professionalName?: string;
      callerNumber?: string;
    }) => {
      console.log('[Socket.io] Starting session for call:', data.callSid);
      
      // Initialize session
      session = {
        callSid: data.callSid,
        userId: data.userId,
        state: 'greeting',
        context: {
          professionalName: data.professionalName,
          attendeePhone: data.callerNumber,
        },
        startTime: new Date(),
        audioBuffer: [],
        transcript: [],
      };
      
      activeSessions.set(data.callSid, session);
      
      // Initialize conversation manager
      conversationManager = new ConversationManager(session, {
        onStateChange: (state) => {
          console.log('[Conversation] State changed:', state);
          socket.emit('state', { state });
        },
        onResponse: async (text) => {
          socket.emit('assistant_message', { text });
          await sendTTSResponse(text, session!, socket, elevenLabs);
        },
      });

      // Initialize Deepgram for STT
      deepgram = new DeepgramSTT(process.env.DEEPGRAM_API_KEY!, {
        onTranscript: async (text, isFinal) => {
          if (isFinal && conversationManager) {
            console.log('[User]:', text);
            socket.emit('transcript', { text, role: 'user', isFinal });
            const response = await conversationManager.processUserInput(text);
            await sendTTSResponse(response, session!, socket, elevenLabs);
          } else {
            socket.emit('transcript', { text, role: 'user', isFinal });
          }
        },
        onError: (err) => {
          console.error('[Deepgram] Error:', err);
          socket.emit('error', { message: err.message });
        },
      });

      await deepgram.connect('fr');

      // Initialize ElevenLabs for TTS
      elevenLabs = new ElevenLabsTTS(
        process.env.ELEVENLABS_API_KEY!,
        process.env.ELEVENLABS_VOICE_ID
      );

      // Send initial greeting
      // @ts-ignore - accessing internal method
      const greeting = conversationManager.getGreeting?.() || "Bonjour! Comment puis-je vous aider?";
      await sendTTSResponse(greeting, session, socket, elevenLabs);
    });

    socket.on('audio', (data: { audio: string }) => {
      // Receive base64 audio from client and send to Deepgram
      if (deepgram) {
        const audioBuffer = Buffer.from(data.audio, 'base64');
        deepgram.sendAudio(audioBuffer);
      }
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Client disconnected:', socket.id);
      cleanup();
    });

    function cleanup() {
      if (session) {
        saveCallRecord(session);
        activeSessions.delete(session.callSid);
      }
      deepgram?.disconnect();
      session = null;
      conversationManager = null;
      deepgram = null;
      elevenLabs = null;
    }
  });

  return io;
}

async function sendTTSResponse(
  text: string,
  session: CallSession,
  socket: any,
  elevenLabs: ElevenLabsTTS | null
) {
  try {
    console.log('[Assistant]:', text);
    socket.emit('assistant_message', { text });
    
    if (elevenLabs) {
      const audioBuffer = await elevenLabs.synthesize(text, 'fr');
      socket.emit('audio', { audio: audioBuffer.toString('base64') });
    }
  } catch (err) {
    console.error('[TTS] Error:', err);
  }
}

async function saveCallRecord(session: CallSession) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('voice_calls').update({
      transcript: session.transcript,
      endedAt: new Date().toISOString(),
      context: session.context,
    }).eq('callSid', session.callSid);
  } catch (err) {
    console.error('Error saving call record:', err);
  }
}
