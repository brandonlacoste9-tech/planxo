import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // The LLM will provide these simple parameters
    const { 
      name, 
      email, 
      start, // ISO 8601 UTC
      username = "planxo", 
      eventTypeSlug = "appel-de-decouverte" 
    } = body;

    if (!name || !email || !start) {
      return NextResponse.json({ error: "Missing required parameters: name, email, start" }, { status: 400 });
    }

    // Proxy the call to the actual internal booking API
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    const bookPayload = {
      username,
      eventTypeSlug,
      start,
      attendee: {
        name,
        email,
        timeZone: "America/Toronto"
      },
      metadata: {
        notes: "Réservation effectuée par l'Assistant Vocal Planxo AI"
      }
    };

    const res = await fetch(`${baseUrl}/api/v2/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookPayload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Échec de la réservation");
    }

    return NextResponse.json({
      success: true,
      message: "Rendez-vous réservé avec succès !",
      booking: data.data
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
