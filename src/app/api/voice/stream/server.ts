// WebSocket streaming server using Socket.io
// Run this as a separate server alongside Next.js

import { createServer } from 'http';
import { Server } from 'socket.io';
import { CallSession } from '../../../../lib/voice/types';
import { ConversationManager } from '../../../../lib/voice/conversation';
import { DeepgramSTT } from '../../../../lib/voice/deepgram';
import { ElevenLabsTTS } from '../../../../lib/voice/elevenlabs';

const activeSessions = new Map<string, CallSession>();

export function initVoiceWebSocketServer(httpServer: ReturnType<typeof createServer>) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const voiceNamespace = io.of('/voice');

  voiceNamespace.on('connection', (socket) => {
    console.log('[Voice] Client connected:', socket.id);
    
    let session: CallSession | null = null;
    let conversationManager: ConversationManager | null = null;
    let deepgram: DeepgramSTT | null = null;
    let elevenLabs: ElevenLabsTTS | null = null;

    socket.on('start_call', async (data: { 
      callSid: string; 
      userId: string; 
      professionalName?: string;
      callerNumber?: string;
      eventTypeId?: string;
    }) => {
      console.log('[Voice] Starting session for call:', data.callSid);
      
      session = {
        callSid: data.callSid,
        userId: data.userId,
        eventTypeId: data.eventTypeId,
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
      
      conversationManager = new ConversationManager(session, {
        onStateChange: (state) => {
          console.log('[Voice] State:', state);
          socket.emit('state_change', { state });
        },
        onResponse: async (text) => {
          socket.emit('assistant_message', { text });
          await sendTTSResponse(text, session!, socket, elevenLabs);
        },
      });

      deepgram = new DeepgramSTT(process.env.DEEPGRAM_API_KEY!, {
        onTranscript: async (text, isFinal) => {
          socket.emit('transcript', { text, role: 'user', isFinal });
          if (isFinal && conversationManager) {
            console.log('[User]:', text);
            const response = await conversationManager.processUserInput(text);
            await sendTTSResponse(response, session!, socket, elevenLabs);
          }
        },
        onError: (err) => {
          console.error('[Deepgram] Error:', err);
          socket.emit('error', { message: err.message });
        },
      });

      await deepgram.connect('fr');

      elevenLabs = new ElevenLabsTTS(
        process.env.ELEVENLABS_API_KEY!,
        process.env.ELEVENLABS_VOICE_ID
      );

      // Send greeting
      const response = await conversationManager.processUserInput('');
      await sendTTSResponse(response, session, socket, elevenLabs);
    });

    socket.on('audio_chunk', (data: { audio: string }) => {
      if (deepgram) {
        const audioBuffer = Buffer.from(data.audio, 'base64');
        deepgram.sendAudio(audioBuffer);
      }
    });

    socket.on('end_call', () => {
      console.log('[Voice] Ending call');
      cleanup();
    });

    socket.on('disconnect', () => {
      console.log('[Voice] Client disconnected:', socket.id);
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
    if (elevenLabs) {
      const audioBuffer = await elevenLabs.synthesize(text, 'fr');
      socket.emit('audio_response', { 
        audio: audioBuffer.toString('base64'),
        text 
      });
    }
  } catch (err) {
    console.error('[TTS] Error:', err);
    socket.emit('error', { message: 'TTS failed' });
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
      finalState: session.state,
    }).eq('callSid', session.callSid);
  } catch (err) {
    console.error('Error saving call record:', err);
  }
}
