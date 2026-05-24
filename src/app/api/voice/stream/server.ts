// WebSocket streaming server using Socket.io
// Run this as a separate server alongside Next.js

import { createServer } from 'http';
import { Server } from 'socket.io';
import { CallSession } from '../../../../lib/voice/types';
import { ConversationManager } from '../../../../lib/voice/conversation';
import { DeepgramSTT } from '../../../../lib/voice/deepgram';
import { ElevenLabsTTS } from '../../../../lib/voice/elevenlabs';
import { getCreditBalance, deductCredits, calculateCallCost } from '../../../../lib/voice/credits';
import { createClient } from '@supabase/supabase-js';

const activeSessions = new Map<string, CallSession>();
const callStartTimes = new Map<string, Date>();

// Supabase client for credit operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
    let creditsDeducted = 0;
    let creditCheckInterval: NodeJS.Timeout | null = null;

    socket.on('start_call', async (data: { 
      callSid: string; 
      userId: string; 
      professionalName?: string;
      callerNumber?: string;
      eventTypeId?: string;
    }) => {
      console.log('[Voice] Starting session for call:', data.callSid);
      
      // Check credits before starting
      const balance = await getCreditBalance(data.userId);
      const minRequired = 15; // $0.15 = 1 minute minimum
      
      if (balance < minRequired) {
        console.error('[Voice] Insufficient credits:', balance);
        socket.emit('error', { 
          code: 'INSUFFICIENT_CREDITS',
          message: 'Insufficient credits. Please purchase more credits to make calls.',
          balance,
          required: minRequired
        });
        return;
      }
      
      // Track call start time
      callStartTimes.set(data.callSid, new Date());
      
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

      // Start credit monitoring (check every 30 seconds)
      creditCheckInterval = setInterval(async () => {
        await checkAndDeductCredits(data.callSid, data.userId);
      }, 30000);

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

    async function checkAndDeductCredits(callSid: string, userId: string) {
      const startTime = callStartTimes.get(callSid);
      if (!startTime) return;

      const now = new Date();
      const durationSeconds = (now.getTime() - startTime.getTime()) / 1000;
      const cost = calculateCallCost(durationSeconds, 0.15);
      
      // Only deduct if cost increased
      if (cost > creditsDeducted) {
        const amountToDeduct = cost - creditsDeducted;
        const success = await deductCredits(userId, amountToDeduct, callSid, `Voice call (${Math.floor(durationSeconds)}s)`);
        
        if (success) {
          creditsDeducted = cost;
          console.log(`[Voice] Deducted ${amountToDeduct} credits for call ${callSid}. Total: ${cost}`);
          
          // Update voice_calls record
          await supabase.from('voice_calls').update({
            creditsUsed: cost,
            recordingDuration: Math.floor(durationSeconds)
          }).eq('callSid', callSid);
          
          // Check if running low
          const newBalance = await getCreditBalance(userId);
          if (newBalance < 30) { // Less than $0.30
            socket.emit('low_credits_warning', { balance: newBalance });
          }
        } else {
          console.error('[Voice] Failed to deduct credits, ending call');
          socket.emit('error', { 
            code: 'CREDIT_DEDUCTION_FAILED',
            message: 'Unable to process payment for this call'
          });
          cleanup();
        }
      }
    }

    async function cleanup() {
      if (creditCheckInterval) {
        clearInterval(creditCheckInterval);
        creditCheckInterval = null;
      }
      
      if (session) {
        // Final credit deduction
        await checkAndDeductCredits(session.callSid, session.userId);
        await saveCallRecord(session, creditsDeducted);
        activeSessions.delete(session.callSid);
        callStartTimes.delete(session.callSid);
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

async function saveCallRecord(session: CallSession, creditsUsed: number) {
  try {
    const duration = session.startTime 
      ? Math.floor((new Date().getTime() - session.startTime.getTime()) / 1000)
      : 0;

    await supabase.from('voice_calls').update({
      transcript: session.transcript,
      endedAt: new Date().toISOString(),
      context: session.context,
      finalState: session.state,
      creditsUsed,
      recordingDuration: duration,
      costPerMinute: 0.15
    }).eq('callSid', session.callSid);
  } catch (err) {
    console.error('Error saving call record:', err);
  }
}
