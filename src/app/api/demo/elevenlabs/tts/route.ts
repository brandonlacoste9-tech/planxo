import { NextRequest, NextResponse } from "next/server";

// Public demo TTS endpoint - no auth required (for /demo/voice only)
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API Key not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { text, voiceId, language = "fr" } = body;

    if (!text || !voiceId) {
      return NextResponse.json({ error: "Missing text or voiceId" }, { status: 400 });
    }

    // Limit demo usage to reasonable length
    if (text.length > 2000) {
      return NextResponse.json({ error: "Text too long for demo" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.4,
            use_speaker_boost: true,
          },
          language_code: language === "fr" ? "fr" : "en",
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Demo TTS] ElevenLabs error:", errorText);
      return NextResponse.json(
        { error: `ElevenLabs error: ${res.status}` },
        { status: 502 }
      );
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("[Demo TTS] Error:", error);
    return NextResponse.json({ error: error.message || "TTS generation failed" }, { status: 500 });
  }
}
