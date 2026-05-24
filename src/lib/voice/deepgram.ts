import WebSocket from 'ws';
import { DeepgramResponse } from './types';

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private onTranscript: (text: string, isFinal: boolean) => void;
  private onError: (error: Error) => void;

  constructor(
    apiKey: string,
    callbacks: {
      onTranscript: (text: string, isFinal: boolean) => void;
      onError: (error: Error) => void;
    }
  ) {
    this.apiKey = apiKey;
    this.onTranscript = callbacks.onTranscript;
    this.onError = callbacks.onError;
  }

  connect(language: 'fr' | 'en' = 'fr'): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        model: 'nova-2',
        language: language === 'fr' ? 'fr' : 'en',
        interim_results: 'true',
        smart_format: 'true',
        diarize: 'false',
        punctuate: 'true',
        utterance_end_ms: '1000',
        vad_events: 'true',
      });

      this.ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?${params.toString()}`,
        {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        }
      );

      this.ws.on('open', () => {
        console.log('[Deepgram] Connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const response: DeepgramResponse = JSON.parse(data.toString());
          this.handleResponse(response);
        } catch (err) {
          console.error('[Deepgram] Parse error:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[Deepgram] Error:', err);
        this.onError(err);
        reject(err);
      });

      this.ws.on('close', () => {
        console.log('[Deepgram] Disconnected');
      });
    });
  }

  private handleResponse(response: DeepgramResponse) {
    if (response.type === 'Results' && response.channel) {
      const transcript = response.channel.alternatives[0]?.transcript;
      const isFinal = response.is_final || false;
      
      if (transcript && transcript.trim()) {
        this.onTranscript(transcript, isFinal);
      }
    }
  }

  sendAudio(audioBuffer: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioBuffer);
    }
  }

  disconnect() {
    if (this.ws) {
      // Send close stream message
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      setTimeout(() => {
        this.ws?.close();
        this.ws = null;
      }, 100);
    }
  }
}
