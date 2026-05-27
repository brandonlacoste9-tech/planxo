import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

    // Build slots API URL
    const slotsUrl = new URL(`${baseUrl}/api/v2/slots`);
    slotsUrl.searchParams.set("username", username || user.id);
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
