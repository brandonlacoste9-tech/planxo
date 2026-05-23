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
    const { data: user } = await supabase.from("users").select("id").eq("username", username).single();
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

  const bufB = eventType.bufferBefore || 0;
  const bufA = eventType.bufferAfter || 0;
  const slotLen = eventType.length;
  const interval = 15;
  const schedulingType = eventType.schedulingType || "individual";
  let teamMemberIds: string[] = [];

  // Resolve team members
  if (schedulingType === "round_robin" || schedulingType === "collective") {
    teamMemberIds = eventType.teamMembers || [eventType.userId];
  } else {
    teamMemberIds = [eventType.userId];
  }

  // Get schedules for all team members (userId-based, no isDefault filter)
  const { data: schedules } = await supabase.from("Schedule").select("id,userId").in("userId", teamMemberIds);
  if (!schedules?.length) return NextResponse.json({ status: "success", data: {} });

  const scheduleIds = schedules.map((s: any) => s.id);
  const { data: allIntervals } = await supabase.from("Availability").select("*").in("scheduleId", scheduleIds);

  // Get all local bookings in range for ALL team members
  const { data: allBookings } = await supabase.from("Booking").select("startTime,endTime,userId").eq("eventTypeId", eventTypeId).neq("status", "cancelled").gte("startTime", rangeStart.toISOString()).lte("startTime", rangeEnd.toISOString());

  const slotsByDay: Record<string, string[]> = {};

  // Iterate each day in range
  const cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const dayStr = cursor.toISOString().split("T")[0];
    const dayOfWeek = cursor.getDay();

    for (const sched of schedules) {
      const memberIntervals = (allIntervals || []).filter((i: any) => i.scheduleId === sched.id && Array.isArray(i.days) && i.days.includes(dayOfWeek));
      const memberBookings = (allBookings || []).filter((b: any) => b.userId === sched.userId);

      for (const avail of memberIntervals) {
        const startTime = typeof avail.startTime === "string" ? avail.startTime.slice(0, 5) : String(avail.startTime);
        const endTime = typeof avail.endTime === "string" ? avail.endTime.slice(0, 5) : String(avail.endTime);
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;

        for (let m = startMin; m + slotLen <= endMin; m += interval) {
          const h = Math.floor(m / 60), min = m % 60;
          const slotTime = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
          const slotStart = new Date(`${dayStr}T${slotTime}:00`);
          const slotEnd = new Date(slotStart.getTime() + slotLen * 60000);
          const bStart = new Date(slotStart.getTime() - bufB * 60000);
          const bEnd = new Date(slotEnd.getTime() + bufA * 60000);

          // Check this member's booking conflicts
          const conflict = memberBookings.some((b: any) => new Date(b.startTime) < bEnd && new Date(b.endTime) > bStart);

          if (!conflict) {
            const iso = slotStart.toISOString();
            const key = `${dayStr}|${iso}|${sched.userId}`;

            if (schedulingType === "collective") {
              // For collective: track which members are free at each slot
              if (!slotsByDay[dayStr]) slotsByDay[dayStr] = [];
              const existing = slotsByDay[dayStr].filter(s => s.startsWith(`${iso}|`));
              if (!existing.length) {
                slotsByDay[dayStr].push(`${iso}|${sched.userId}`);
              }
            } else {
              // Round-robin / individual: this member has a free slot
              if (!slotsByDay[dayStr]) slotsByDay[dayStr] = [];
              if (!slotsByDay[dayStr].includes(iso)) {
                slotsByDay[dayStr].push(iso);
              }
            }
          }
        }
      }
    }

    // For collective scheduling: filter out slots where not all members are free
    if (schedulingType === "collective" && slotsByDay[dayStr]) {
      const membersNeeded = teamMemberIds.length;
      const slotCounts: Record<string, number> = {};
      for (const entry of slotsByDay[dayStr]) {
        const [iso] = entry.split("|");
        slotCounts[iso] = (slotCounts[iso] || 0) + 1;
      }
      slotsByDay[dayStr] = Object.entries(slotCounts)
        .filter(([_, count]) => count >= membersNeeded)
        .map(([iso]) => iso);
      if (!slotsByDay[dayStr].length) delete slotsByDay[dayStr];
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({ status: "success", data: slotsByDay });
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
