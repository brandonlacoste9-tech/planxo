import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

function isValidElevenLabsAuth(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return false;

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return !!match && match[1] === apiKey;
}

/**
 * ElevenLabs Tool: Create Booking
 *
 * Called by the Conversational AI agent (server-side with Bearer ELEVENLABS_API_KEY
 * + a `username` target) or from the browser (cookie auth) to create a booking.
 */
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
    const { name, email, start_time, duration = 30, notes, username, eventTypeSlug } = body;

    if (!name || !email || !start_time) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          message: "I need your name, email, and preferred time to complete the booking.",
        },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
          message: "Please provide a valid email address.",
        },
        { status: 400 }
      );
    }

    if (Number.isNaN(new Date(start_time).getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid datetime format",
          message: "Please provide a valid date and time.",
        },
        { status: 400 }
      );
    }

    const isElevenLabs = isValidElevenLabsAuth(request);
    if (isElevenLabs && !username) {
      return NextResponse.json(
        { error: "username is required for ElevenLabs tool calls" },
        { status: 400 }
      );
    }

    const userId = isElevenLabs
      ? username
      : (await (await createClient()).auth.getUser()).data.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    // /api/v2/ai/book expects: { name, email, start, username, eventSlug }
    const bookingResponse = await fetch(`${baseUrl}/api/v2/ai/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-proto": protocol,
        host: host || "",
      },
      body: JSON.stringify({
        name,
        email,
        start: start_time,
        username: userId,
        eventSlug: eventTypeSlug,
        guestNotes: notes,
      }),
    });

    const bookingData = await bookingResponse.json();
    if (!bookingResponse.ok) {
      throw new Error(bookingData.error || "Booking failed");
    }

    const appointment = new Date(start_time);
    const formattedDate = appointment.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const formattedTime = appointment.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    return NextResponse.json({
      success: true,
      message: `Appointment confirmed for ${name}`,
      booking: bookingData.booking,
      confirmationDetails: {
        name,
        email,
        date: formattedDate,
        time: formattedTime,
        duration: `${duration} minutes`,
      },
      agentMessage: `Perfect! I've confirmed your appointment for ${formattedDate} at ${formattedTime}. A confirmation email has been sent to ${email}. Is there anything else I can help you with?`,
    });
  } catch (error: any) {
    console.error("[ElevenLabs Tools] Booking error:", error);

    let message = "I encountered an error creating your booking. Please try again.";
    if (error.message?.includes("availability")) {
      message = "That time slot is no longer available. Please choose another time.";
    }

    return NextResponse.json(
      { success: false, error: error.message || "Booking failed", message },
      { status: 500 }
    );
  }
}
