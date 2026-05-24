import { Readable } from 'stream';

export class ElevenLabsTTS {
  private apiKey: string;
  private voiceId: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string, voiceId: string = 'pNInz6obpgDQGcFmaJgB') {
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  async synthesize(text: string, language: 'fr' | 'en' = 'fr'): Promise<Buffer> {
    const response = await fetch(
      `${this.baseUrl}/text-to-speech/${this.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
          language_code: language === 'fr' ? 'fr' : 'en',
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Alternative: Use Twilio's native TTS (cheaper, less natural)
  static getTwilioTTSUrl(text: string, language: 'fr' | 'en' = 'fr'): string {
    const voice = language === 'fr' ? 'Polly.Celine' : 'Polly.Joanna';
    const encodedText = encodeURIComponent(text);
    return `https://api.twilio.com/calls/TODO/Twiml?Twiml=<Response><Say voice="${voice}">${encodedText}</Say></Response>`;
  }
}
