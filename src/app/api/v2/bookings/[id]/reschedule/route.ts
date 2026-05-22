import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/v2/bookings/:id/reschedule
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const newStart = new Date(body.start);
  if (isNaN(newStart.getTime())) return apiError("Invalid start time", 400);

  const { data: booking } = await supabase.from("Booking").select("*, eventType:EventType(*)").eq("id", id).single();
  if (!booking) return apiError("Booking not found", 404);

  const lengthMinutes = body.lengthInMinutes || booking.eventType.length;
  const newEnd = new Date(newStart.getTime() + lengthMinutes * 60000);

  const { data: updated, error } = await supabase.from("Booking").update({
    startTime: newStart.toISOString(),
    endTime: newEnd.toISOString(),
    status: "confirmed",
    updatedAt: new Date().toISOString(),
  }).eq("id", id).select("*, eventType:EventType(*)").single();

  if (error) return apiError(error.message, 500);

  return NextResponse.json({ status: "success", data: {
    id: updated.id, uid: updated.id,
    start: updated.startTime, end: updated.endTime,
    status: "accepted",
    attendees: [{ name: updated.guestName, email: updated.guestEmail }],
    meetingUrl: updated.meetingUrl,
  }});
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
