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

// DELETE /api/v2/bookings/:id
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  try {
    // First, check if the booking exists
    const { data: booking, error: fetchError } = await supabase
      .from("Booking")
      .select("id, userId")
      .eq("id", id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { status: "error", error: { message: "Booking not found" } },
        { status: 404 }
      );
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from("Booking")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json(
        { status: "error", error: { message: "Failed to delete booking" } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      message: "Booking deleted successfully",
      data: { id },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: { message: error?.message || "Internal server error" } },
      { status: 500 }
    );
  }
}
