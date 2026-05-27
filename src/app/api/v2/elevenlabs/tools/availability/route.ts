import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isValidElevenLabsAuth(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return false;

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return !!match && match[1] === apiKey;
}

/**
 * ElevenLabs Tool: Check Availability
 * 
 * This endpoint is called by ElevenLabs agents to check available appointment slots
 * for a specific date. It integrates with Planxo's existing availability system.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const duration = parseInt(searchParams.get("duration") || "30");
    const timezone = searchParams.get("timezone") || "America/Toronto";
    const eventTypeSlug = searchParams.get("eventTypeSlug");
    const username = searchParams.get("username");

    // Validate required parameters
    if (!date) {
      return NextResponse.json(
        { error: "date parameter is required (YYYY-MM-DD format)" },
        { status: 400 }
      );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const isElevenLabs = isValidElevenLabsAuth(request);

    // When called by ElevenLabs servers, there is no browser session cookie.
    // In that case we require Bearer ELEVENLABS_API_KEY and a target `username` (Planxo userId).
    if (isElevenLabs && !username) {
      return NextResponse.json(
        { error: "username parameter is required for ElevenLabs tool calls" },
        { status: 400 }
      );
    }

    // When called from the app (manual testing in browser), fall back to the normal cookie-auth flow.
    const supabase = isElevenLabs ? await createAdminClient() : await createClient();
    const userId =
      username ||
      (isElevenLabs
        ? undefined
        : (await supabase.auth.getUser()).data.user?.id);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get protocol and host for internal API calls
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const host = request.headers.get("host");
    const baseUrl = `${protocol}://${host}`;

    // Build slots API URL
    const slotsUrl = new URL(`${baseUrl}/api/v2/slots`);
    slotsUrl.searchParams.set("username", userId);
    slotsUrl.searchParams.set("date", date);
    slotsUrl.searchParams.set("timeZone", timezone);
    
    if (eventTypeSlug) {
      slotsUrl.searchParams.set("eventTypeSlug", eventTypeSlug);
    }

    // Fetch available slots from Planxo's slots API
    const slotsResponse = await fetch(slotsUrl.toString(), {
      headers: {
        "x-forwarded-proto": protocol,
        "host": host || ""
      }
    });

    if (!slotsResponse.ok) {
      const errorData = await slotsResponse.json();
      throw new Error(errorData.error?.message || "Failed to fetch slots");
    }

    const slotsData = await slotsResponse.json();
    const slots = slotsData.data?.slots || [];

    // Format slots for ElevenLabs agent
    const availableSlots = slots.map((slot: any) => {
      const slotTime = new Date(slot.time);
      return {
        time: slotTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
          hour12: true
        }),
        isoTime: slot.time,
        available: true
      };
    });

    // Format response for ElevenLabs agent
    return NextResponse.json({
      success: true,
      date,
      timezone,
      duration,
      availableSlots,
      slotCount: availableSlots.length,
      message: availableSlots.length > 0
        ? `Found ${availableSlots.length} available slots for ${date}`
        : `No available slots found for ${date}. Please choose another date.`,
      formattedSlots: availableSlots
        .map((s: any) => s.time)
        .join(", ") || "No slots available"
    });
  } catch (error: any) {
    console.error("[ElevenLabs Tools] Availability error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to check availability",
        message: "I encountered an error checking availability. Please try again."
      },
      { status: 500 }
    );
  }
}
