import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
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
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return apiError("User not found", 404);
    const et = await prisma.eventType.findFirst({ where: { slug: eventTypeSlug, userId: user.id } });
    if (!et) return apiError("Event type not found", 404);
    eventTypeId = et.id;
  }

  if (!eventTypeId) return apiError("eventTypeId or eventTypeSlug required", 400);

  const eventType = await prisma.eventType.findUnique({ where: { id: eventTypeId } });
  if (!eventType) return apiError("Event type not found", 404);

  // Minimum booking notice cutoff — slots starting before this are filtered out
  const minNoticeMs = (eventType?.minimumBookingNotice ?? 120) * 60 * 1000;
  const noticeCutoff = new Date(Date.now() + minNoticeMs);

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

  // --- TASK 14C: Use event type's scheduleId if set ---
  const scheduleId: number | null = eventType.scheduleId || null;

  // Get schedules for all team members
  let schedules = await prisma.schedule.findMany({
    where: { userId: { in: teamMemberIds } }
  });
  // If a specific schedule is linked to this event type, restrict to it
  if (scheduleId) {
    schedules = await prisma.schedule.findMany({
      where: { id: String(scheduleId), userId: { in: teamMemberIds } }
    });
  }
  if (!schedules?.length) return NextResponse.json({ status: "success", data: {} });

  const scheduleIds = schedules.map((s: any) => s.id);
  const allIntervals = await prisma.availability.findMany({
    where: { scheduleId: { in: scheduleIds } }
  });

  // --- TASK 13D: Fetch date overrides (blocked dates) for the host ---
  const hostUserId = eventType.userId;
  const { data: overrides } = await supabase
    .from("availability_overrides")
    .select("date")
    .eq("user_id", hostUserId);
  const blockedDates = new Set((overrides || []).map((o: any) => {
    // date may come as 'YYYY-MM-DD' or with time component
    return typeof o.date === "string" ? o.date.slice(0, 10) : o.date;
  }));

  // Get all local bookings in range for ALL team members
  const allBookings = await prisma.booking.findMany({
    where: {
      eventTypeId,
      status: { not: "cancelled" },
      startTime: { gte: rangeStart, lte: rangeEnd }
    },
    select: { startTime: true, endTime: true, userId: true }
  });

  const slotsByDay: Record<string, string[]> = {};

  // Iterate each day in range
  const cursor = new Date(rangeStart);
  while (cursor < rangeEnd) {
    const dayStr = cursor.toISOString().split("T")[0];
    const dayOfWeek = cursor.getDay();

    // --- TASK 13D: Skip blocked dates ---
    if (blockedDates.has(dayStr)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

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
          // Construct slot in user's timezone, then convert to UTC
          const localDate = new Date(`${dayStr}T${slotTime}:00`);
          const tzOffsets: Record<string, number> = {
            "America/Toronto": -4, "America/New_York": -4, "America/Vancouver": -7,
            "America/Chicago": -5, "America/Denver": -6, "Europe/Paris": 2, "Europe/London": 1,
          };
          const tzOffsetHours = tzOffsets[timeZone] ?? 0;
          const slotStart = new Date(localDate.getTime() - tzOffsetHours * 3600000);
          const slotEnd = new Date(slotStart.getTime() + slotLen * 60000);
          const bStart = new Date(slotStart.getTime() - bufB * 60000);
          const bEnd = new Date(slotEnd.getTime() + bufA * 60000);

          // Check this member's booking conflicts
          const conflict = memberBookings.some((b: any) => new Date(b.startTime) < bEnd && new Date(b.endTime) > bStart);

          if (!conflict) {
            const iso = slotStart.toISOString();

            // Skip slots within minimumBookingNotice window from now
            if (slotStart <= noticeCutoff) continue;

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
