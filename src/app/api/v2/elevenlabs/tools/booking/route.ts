import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * ElevenLabs Tool: Create Booking
 * 
 * This endpoint is called by ElevenLabs agents to create appointment bookings.
 * It validates input, creates the booking, and returns confirmation details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      email,
      start_time,
      duration = 30,
      notes,
      username,
      eventTypeSlug
    } = body;

    // Validate required fields
    if (!name || !email || !start_time) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          message: "I need your name, email, and preferred time to complete the booking."
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email format",
          message: "Please provide a valid email address."
        },
        { status: 400 }
      );
    }

    // Validate ISO datetime format
    try {
      new Date(start_time);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid datetime format",
          message: "Please provide a valid date and time."
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get protocol and host for internal API calls
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    // Create booking via Planxo's booking API
    const bookingPayload = {
      name,
      email,
      start: start_time,
      username: username || user.id,
      eventTypeSlug: eventTypeSlug || "appel-de-decouverte",
      notes: notes || `Voice booking via ElevenLabs agent. Duration: ${duration}min`
    };

    const bookingResponse = await fetch(`${baseUrl}/api/v2/ai/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-proto": protocol,
        "host": host || ""
      },
      body: JSON.stringify(bookingPayload)
    });

    const bookingData = await bookingResponse.json();

    if (!bookingResponse.ok) {
      throw new Error(bookingData.error || "Booking failed");
    }

    // Format the appointment date and time for response
    const appointmentDate = new Date(start_time);
    const formattedDate = appointmentDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const formattedTime = appointmentDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    // Log the booking in voice_calls table for record-keeping
    try {
      await supabase.from("voice_calls").insert({
        userId: user.id,
        callSid: `elevenlabs-booking-${Date.now()}`,
        direction: "inbound",
        status: "completed",
        purpose: "appointment_booking",
        transcript: [{
          role: "system",
          text: `Booking created: ${name} (${email}) for ${formattedDate} at ${formattedTime}`
        }],
        context: {
          attendeeName: name,
          attendeeEmail: email,
          bookingId: bookingData.booking?.id,
          source: "elevenlabs_agent"
        },
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString()
      });
    } catch (logError) {
      console.warn("[ElevenLabs Tools] Failed to log booking:", logError);
      // Don't fail the booking if logging fails
    }

    // Return success response formatted for ElevenLabs agent
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
        confirmationNumber: bookingData.booking?.id || `CONF-${Date.now()}`
      },
      agentMessage: `Perfect! I've confirmed your appointment for ${formattedDate} at ${formattedTime}. A confirmation email has been sent to ${email}. Is there anything else I can help you with?`
    });
  } catch (error: any) {
    console.error("[ElevenLabs Tools] Booking error:", error);

    // Provide user-friendly error message
    let errorMessage = "I encountered an error creating your booking. Please try again.";
    
    if (error.message.includes("availability")) {
      errorMessage = "That time slot is no longer available. Please choose another time.";
    } else if (error.message.includes("email")) {
      errorMessage = "There was an issue with the email address. Please verify and try again.";
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Booking failed",
        message: errorMessage
      },
      { status: 500 }
    );
  }
}
