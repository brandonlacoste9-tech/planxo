import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventTypeId = searchParams.get("eventTypeId");
  const dateStr = searchParams.get("date");
  const timeZone = searchParams.get("timeZone") || "America/Toronto";

  if (!eventTypeId || !dateStr)
    return NextResponse.json({ error: "eventTypeId and date required" }, { status: 400 });

  const { data: eventType } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
  if (!eventType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const date = new Date(dateStr + "T12:00:00");
  const dayOfWeek = date.getDay();

  const { data: schedule } = await supabase.from("Schedule").select("*").eq("userId", eventType.userId).eq("isDefault", true).single();
  if (!schedule) return NextResponse.json({ slots: [] });

  const { data: intervals } = await supabase.from("Availability").select("*").eq("scheduleId", schedule.id).eq("dayOfWeek", dayOfWeek).eq("isActive", true);
  if (!intervals?.length) return NextResponse.json({ slots: [] });

  const dayStart = dateStr + "T00:00:00";
  const dayEnd = dateStr + "T23:59:59";
  const { data: bookings } = await supabase.from("Booking").select("*").eq("eventTypeId", eventTypeId).neq("status", "cancelled").gte("startTime", dayStart).lte("startTime", dayEnd);

  const maxPerDay = eventType.maxPerDay;
  const dailyCount = bookings?.length || 0;
  if (maxPerDay && dailyCount >= maxPerDay) {
    return NextResponse.json({ eventTypeId, date: dateStr, timeZone, length: eventType.length, slots: [], dailyCapReached: true, dailyBookings: dailyCount, maxPerDay });
  }

  const slots: string[] = [];
  const bufB = eventType.bufferBefore || 0;
  const bufA = eventType.bufferAfter || 0;
  const slotDuration = eventType.length;
  const interval = 15;

  for (const avail of intervals) {
    const [sh, sm] = avail.startTime.split(":").map(Number);
    const [eh, em] = avail.endTime.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;

    for (let m = startMin; m + slotDuration <= endMin; m += interval) {
      const slotH = Math.floor(m / 60);
      const slotM = m % 60;
      const slotTime = `${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`;
      const slotStart = new Date(dateStr + `T${slotTime}:00`);
      const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);
      const blockStart = new Date(slotStart.getTime() - bufB * 60000);
      const blockEnd = new Date(slotEnd.getTime() + bufA * 60000);

      const conflict = bookings?.some((b: any) => {
        const bs = new Date(b.startTime);
        const be = new Date(b.endTime);
        return blockStart < new Date(be.getTime() + bufA * 60000) && blockEnd > new Date(bs.getTime() - bufB * 60000);
      });

      if (!conflict) slots.push(slotTime);
    }
  }

  return NextResponse.json({ eventTypeId, date: dateStr, timeZone, length: eventType.length, bufferBefore: bufB, bufferAfter: bufA, maxPerDay, dailyBookings: dailyCount, dailyCapReached: false, price: eventType.price, currency: eventType.currency, slots });
}
