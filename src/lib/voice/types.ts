export interface VoiceConfig {
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  deepgram: {
    apiKey: string;
  };
  elevenlabs: {
    apiKey: string;
    voiceId: string;
  };
  openai?: {
    apiKey: string;
  };
}

export interface CallSession {
  callSid: string;
  userId: string;
  eventTypeId?: string;
  streamSid?: string;
  state: ConversationState;
  context: CallContext;
  startTime: Date;
  audioBuffer: Buffer[];
  transcript: TranscriptMessage[];
}

export interface CallContext {
  userName?: string;
  professionalName?: string;
  eventTypeTitle?: string;
  duration?: number;
  selectedDate?: string;
  selectedTime?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  attendeePhone?: string;
  availability?: string[];
}

export type ConversationState = 
  | 'greeting'
  | 'identify_purpose'
  | 'collect_name'
  | 'collect_email'
  | 'select_date'
  | 'select_time'
  | 'confirm_booking'
  | 'booking_confirmed'
  | 'goodbye';

export interface TranscriptMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export interface DeepgramResponse {
  type: 'Results' | 'SpeechStarted' | 'UtteranceEnd';
  channel?: {
    alternatives: {
      transcript: string;
      confidence: number;
      words: any[];
    }[];
  };
  is_final?: boolean;
  speech_final?: boolean;
}

export interface TwilioStreamMessage {
  event: 'start' | 'media' | 'stop' | 'connected' | 'disconnected';
  streamSid?: string;
  start?: {
    callSid: string;
    accountSid: string;
    from: string;
    to: string;
    customParameters?: Record<string, string>;
  };
  media?: {
    payload: string;
    track: 'inbound' | 'outbound';
  };
  stop?: {
    callSid: string;
  };
}
