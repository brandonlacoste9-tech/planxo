import { NextResponse } from "next/server";

// Public demo voices endpoint - no auth required (for /demo/voice only)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs API Key not configured" }, { status: 500 });
    }

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`ElevenLabs API Error: ${errorText}`);
    }

    const data = await res.json();

    // Return a clean, limited list suitable for demo
    const voices = (data.voices || [])
      .filter((v: any) => v.category !== "generated") // hide cloned voices in demo
      .slice(0, 30)
      .map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        previewUrl: v.preview_url,
        category: v.category,
        labels: v.labels,
        language: v.labels?.language || v.labels?.accent || null,
      }));

    return NextResponse.json({ voices });
  } catch (error: any) {
    console.error("[Demo Voices] Error fetching voices:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
