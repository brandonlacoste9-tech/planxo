import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") || "planxo";
  const eventTypeSlug = searchParams.get("eventTypeSlug") || "appel-de-decouverte";
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ error: "date parameter is required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    // We proxy the call to the existing slots API
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    
    const slotsUrl = new URL(`${baseUrl}/api/v2/slots`);
    slotsUrl.searchParams.set("username", username);
    slotsUrl.searchParams.set("eventTypeSlug", eventTypeSlug);
    slotsUrl.searchParams.set("date", date);
    slotsUrl.searchParams.set("timeZone", "America/Toronto"); // Default for AI agent

    const res = await fetch(slotsUrl.toString());
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to fetch slots");
    }

    // Format the response specifically for the LLM to understand easily
    const slots = data.data?.slots || [];
    const availableTimes = slots.map((s: any) => {
      const d = new Date(s.time);
      return d.toLocaleTimeString("fr-CA", { hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto' });
    });

    return NextResponse.json({
      message: `Available slots for ${date}`,
      availableTimes,
      rawSlots: slots
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
