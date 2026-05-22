import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/v2/bookings/:id/cancel
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const { data: booking } = await supabase.from("Booking").select("*, eventType:EventType(*)").eq("id", id).single();
  if (!booking) return NextResponse.json({ status: "error", error: { message: "Booking not found" } }, { status: 404 });

  const { data: updated, error } = await supabase.from("Booking").update({
    status: "cancelled",
    updatedAt: new Date().toISOString(),
  }).eq("id", id).select("*, eventType:EventType(*)").single();

  if (error) return NextResponse.json({ status: "error", error: { message: error.message } }, { status: 500 });

  // Fire webhooks
  const { data: webhooks } = await supabase.from("Webhook").select("*").eq("userId", booking.userId).eq("isActive", true);
  for (const wh of webhooks || []) {
    if (wh.events.includes("booking.cancelled")) {
      fetch(wh.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "booking.cancelled",
          booking: { id: updated.id, start: updated.startTime, end: updated.endTime },
          cancellationReason: body.reason || body.cancellationReason || "",
        }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    status: "success",
    data: { id: updated.id, uid: updated.id, status: "cancelled", start: updated.startTime, end: updated.endTime },
  });
}
