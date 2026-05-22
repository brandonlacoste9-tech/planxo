import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getExternalBusyTimes } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let eventTypeId = searchParams.get("eventTypeId");
  const eventTypeSlug = searchParams.get("eventTypeSlug");
  const username = searchParams.get("username") || "planxo";
  const timeZone = searchParams.get("timeZone") || "UTC";
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  // Resolve by slug if needed
  if (!eventTypeId && eventTypeSlug) {
    const { data: user } = await supabase.from("User").select("id").eq("username", username).single();
    if (!user) return apiError("User not found", 404);
    const { data: et } = await supabase.from("EventType").select("id,userId").eq("slug", eventTypeSlug).eq("userId", user.id).single();
    if (!et) return apiError("Event type not found", 404);
    eventTypeId = et.id;
  }

  if (!eventTypeId) return apiError("eventTypeId or eventTypeSlug required", 400);

  const { data: eventType } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
  if (!eventType) return apiError("Event type not found", 404);

  // Parse date range (default: next 7 days)
  const rangeStart = startTime ? new Date(startTime) : new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = endTime ? new Date(endTime) : new Date(rangeStart.getTime() + 7 * 86400000);

  const { data: schedule } = await supabase.from("Schedule").select("*").eq("userId", eventType.userId).eq("isDefault", true).single();
  if (!schedule) return apiError("No schedule found", 404);

  const { data: intervals } = await supabase.from("Availability").select("*").eq("scheduleId", schedule.id).eq("isActive", true);
  if (!intervals?.length) return NextResponse.json({ status: "success", data: {} });

  const bufB = eventType.bufferBefore || 0;
  const bufA = eventType.bufferAfter || 0;
  const slotLen = eventType.length;
  const interval = 15;

  // Get all local bookings in range
  const { data: localBookings } = await supabase.from("Booking").select("startTime,endTime").eq("eventTypeId", eventTypeId).neq("status", "cancelled").gte("startTime", rangeStart.toISOString()).lte("startTime", rangeEnd.toISOString());

  // Get external calendar busy times (Google + Outlook)
  const externalBusy = await getExternalBusyTimes(eventType.userId, rangeStart, rangeEnd);

  const slotsByDay: Record<string, string[]> = {};

  // Iterate each day in range
  const cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const dayStr = cursor.toISOString().split("T")[0];
    const dayOfWeek = cursor.getDay();
    const dayIntervals = intervals.filter((i: any) => i.dayOfWeek === dayOfWeek);

    const daySlots: string[] = [];
    for (const avail of dayIntervals) {
      const [sh, sm] = avail.startTime.split(":").map(Number);
      const [eh, em] = avail.endTime.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      for (let m = startMin; m + slotLen <= endMin; m += interval) {
        const h = Math.floor(m / 60), min = m % 60;
        const slotTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        const slotStart = new Date(`${dayStr}T${slotTime}:00`);
        const slotEnd = new Date(slotStart.getTime() + slotLen * 60000);
        const bStart = new Date(slotStart.getTime() - bufB * 60000);
        const bEnd = new Date(slotEnd.getTime() + bufA * 60000);

        // Check local booking conflicts
        const localConflict = localBookings?.some((b: any) => new Date(b.startTime) < bEnd && new Date(b.endTime) > bStart);

        // Check external calendar conflicts
        const extConflict = externalBusy.some((busy) => busy.start < bEnd && busy.end > bStart);

        if (!localConflict && !extConflict) {
          daySlots.push(slotStart.toISOString());
        }
      }
    }

    if (daySlots.length) slotsByDay[dayStr] = daySlots;
    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({ status: "success", data: slotsByDay });
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
