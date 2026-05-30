import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, 10, 60_000)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez réessayer dans une minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    
    const { 
      name, 
      email, 
      start, // ISO 8601 UTC
      username = "planxo", 
      eventSlug = "consultation-30min",
      timeZone = "America/Toronto"
    } = body;

    if (!name || !email || !start) {
      return NextResponse.json({ error: "Missing required parameters: name, email, start" }, { status: 400 });
    }

    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    // The real /api/v2/bookings POST handler expects:
    // { username, eventSlug, startTime, guestName, guestEmail, timeZone, guestNotes? }
    const bookPayload = {
      username,
      eventSlug,
      startTime: start,
      guestName: name,
      guestEmail: email,
      timeZone,
      guestNotes: "Booked via Planxo AI Assistant"
    };

    const res = await fetch(`${baseUrl}/api/v2/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookPayload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || "Booking failed");
    }

    return NextResponse.json({
      success: true,
      message: "Appointment booked successfully!",
      booking: data.data
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
