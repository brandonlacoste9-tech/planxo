import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/v2/bookings/:id
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: booking } = await supabase.from("Booking").select("*, eventType:EventType(*)").eq("id", id).single();
  if (!booking) return NextResponse.json({ status: "error", error: { message: "Booking not found" } }, { status: 404 });

  return NextResponse.json({
    status: "success",
    data: {
      id: booking.id, uid: booking.id,
      start: booking.startTime, end: booking.endTime,
      status: booking.status === "confirmed" ? "accepted" : booking.status,
      attendees: [{ name: booking.guestName, email: booking.guestEmail }],
      guests: [],
      location: booking.meetingUrl || booking.eventType.location,
      meetingUrl: booking.meetingUrl,
      metadata: {},
      paid: booking.paid,
      eventTypeId: booking.eventTypeId,
    },
  });
}
