import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { getExternalBusyTimes } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

function toPartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value || "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function toLocalDateKey(date: Date, timeZone: string) {
  const p = toPartsInTimeZone(date, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Convert a local YYYY-MM-DD + HH:mm in a specific timeZone into a UTC Date.
function zonedLocalToUtc(dateKey: string, timeHm: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = timeHm.split(":").map(Number);

  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Iterate to account for timezone and DST offset differences.
  for (let i = 0; i < 4; i++) {
    const p = toPartsInTimeZone(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = targetAsUtc - observedAsUtc;
    guess += diff;
    if (diff === 0) break;
  }

  return new Date(guess);
}

function normalizeSchedulingType(value: unknown): "individual" | "round_robin" | "collective" | "pooled" {
  if (typeof value !== "string") return "individual";
  const normalized = value.toLowerCase();
  if (normalized === "round_robin" || normalized === "collective" || normalized === "pooled") {
    return normalized;
  }
  return "individual";
}

function normalizeTeamMembers(value: unknown, fallbackUserId: string) {
  if (Array.isArray(value)) {
    const ids = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }

  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  if (value && typeof value === "object" && "ids" in value && Array.isArray((value as { ids?: unknown[] }).ids)) {
    const ids = (value as { ids: unknown[] }).ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }

  return [fallbackUserId];
}

function isMissingColumnError(error: any) {
  if (error?.code === "P2022") return true;
  const message = String(error?.message || "").toLowerCase();
  return message.includes("does not exist") || message.includes("unknown column");
}

export async function GET(request: NextRequest) {

  const { searchParams } = new URL(request.url);
  let eventTypeId = searchParams.get("eventTypeId");
  const eventTypeSlug = searchParams.get("eventTypeSlug");
  const username = searchParams.get("username") || "planxo";
  const timeZone = searchParams.get("timeZone") || "UTC";
  const startTime = searchParams.get("startTime") || searchParams.get("start");
  const endTime = searchParams.get("endTime") || searchParams.get("end");

  // Validate date format if 'startTime' or 'endTime' is provided
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (startTime && !dateRegex.test(startTime.slice(0, 10))) {
    return apiError("Invalid startTime format. Use YYYY-MM-DD or ISO string.", 400);
  }
  if (endTime && !dateRegex.test(endTime.slice(0, 10))) {
    return apiError("Invalid endTime format. Use YYYY-MM-DD or ISO string.", 400);
  }

  // Resolve by slug if needed
  if (!eventTypeId && eventTypeSlug) {
    const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) return apiError("User not found", 404);
    const et = await prisma.eventType.findFirst({ where: { slug: eventTypeSlug, userId: user.id }, select: { id: true } });
    if (!et) return apiError("Event type not found", 404);
    eventTypeId = et.id;
  }

  if (!eventTypeId) return apiError("eventTypeId or eventTypeSlug required", 400);

  let eventType: any = null;
  try {
    eventType = await prisma.eventType.findUnique({
      where: { id: eventTypeId },
      select: {
        id: true,
        userId: true,
        length: true,
        minNotice: true,
        bufferBefore: true,
        bufferAfter: true,
        maxPerDay: true,
        schedulingType: true,
        teamMembers: true,
        scheduleId: true,
        isActive: true,
      },
    });
  } catch (error: any) {
    // Backward compatibility while DB migration is rolling out.
    if (!isMissingColumnError(error)) throw error;
    try {
      eventType = await prisma.eventType.findUnique({
        where: { id: eventTypeId },
        select: {
          id: true,
          userId: true,
          length: true,
          minNotice: true,
          bufferBefore: true,
          bufferAfter: true,
          maxPerDay: true,
          scheduleId: true,
          isActive: true,
        },
      });
    } catch (legacyError: any) {
      if (!isMissingColumnError(legacyError)) throw legacyError;
      eventType = await prisma.eventType.findUnique({
        where: { id: eventTypeId },
        select: {
          id: true,
          userId: true,
          length: true,
        },
      });
    }

    if (eventType) {
      eventType = {
        ...eventType,
        minNotice: eventType.minNotice ?? 60,
        bufferBefore: eventType.bufferBefore ?? 0,
        bufferAfter: eventType.bufferAfter ?? 0,
        maxPerDay: eventType.maxPerDay ?? null,
        scheduleId: eventType.scheduleId ?? null,
        isActive: eventType.isActive ?? true,
        schedulingType: "individual",
        teamMembers: [eventType.userId],
      };
    }
  }
  if (!eventType) return apiError("Event type not found", 404);
  const et: any = eventType;

  if (!et.isActive) {
    return NextResponse.json({ status: "success", data: {} });
  }

  // Minimum booking notice cutoff — slots starting before this are filtered out
  const minNoticeMs = (et.minNotice ?? 60) * 60 * 1000;
  const noticeCutoff = new Date(Date.now() + minNoticeMs);

  // Parse date range as local calendar days in requested timezone (default: next 7 days).
  const rangeStartDay = startTime ? startTime.slice(0, 10) : toLocalDateKey(new Date(), timeZone);
  const rangeEndDay = endTime ? endTime.slice(0, 10) : addDaysToDateKey(rangeStartDay, 6);
  const rangeStart = zonedLocalToUtc(rangeStartDay, "00:00", timeZone);
  const rangeEnd = new Date(zonedLocalToUtc(rangeEndDay, "23:59", timeZone).getTime() + 59999);

  const bufB = et.bufferBefore || 0;
  const bufA = et.bufferAfter || 0;
  const slotLen = et.length;
  const interval = 15;
  const schedulingType = normalizeSchedulingType(et.schedulingType);
  let teamMemberIds: string[] = [];

  // Resolve team members
  if (schedulingType === "round_robin" || schedulingType === "collective" || schedulingType === "pooled") {
    teamMemberIds = normalizeTeamMembers(et.teamMembers, et.userId);
  } else {
    teamMemberIds = [et.userId];
  }

  // Prefer event-specific schedule when configured.
  const scheduleId: string | null = et.scheduleId ? String(et.scheduleId) : null;

  // Get schedules for all team members
  let schedules = await prisma.schedule.findMany({
    where: { userId: { in: teamMemberIds } },
    select: { id: true, userId: true, timeZone: true },
  });
  // If a specific schedule is linked to this event type, restrict to it
  if (scheduleId) {
    schedules = await prisma.schedule.findMany({
      where: { id: String(scheduleId), userId: { in: teamMemberIds } },
      select: { id: true, userId: true, timeZone: true },
    });
  }
  if (!schedules?.length) return NextResponse.json({ status: "success", data: {} });

  const scheduleIds = schedules.map((s: any) => s.id);
  let allIntervals: any[] = [];
  try {
    allIntervals = await prisma.availability.findMany({
      where: { scheduleId: { in: scheduleIds }, isActive: true },
      select: {
        scheduleId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isActive: true,
      },
    });
  } catch (error: any) {
    if (!isMissingColumnError(error)) throw error;
    allIntervals = await prisma.availability.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: {
        scheduleId: true,
        startTime: true,
        endTime: true,
      },
    });
  }

  // Load host-level blocked dates (availability overrides).
  const hostUserId = et.userId;
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

  const externalBusyByUser = new Map<string, Array<{ start: Date; end: Date }>>();
  await Promise.all(
    teamMemberIds.map(async (memberId) => {
      try {
        const busySlots = await getExternalBusyTimes(memberId, rangeStart, rangeEnd);
        externalBusyByUser.set(memberId, busySlots || []);
      } catch {
        externalBusyByUser.set(memberId, []);
      }
    })
  );

  const bookingsPerUserPerDay = new Map<string, number>();
  for (const b of allBookings) {
    const key = `${b.userId}|${toLocalDateKey(new Date(b.startTime), timeZone)}`;
    bookingsPerUserPerDay.set(key, (bookingsPerUserPerDay.get(key) || 0) + 1);
  }

  const slotsByDay: Record<string, string[]> = {};

  // Iterate each day in range
  let dayCursor = rangeStartDay;
  while (dayCursor <= rangeEndDay) {
    const dayStr = dayCursor;
    const dayOfWeek = new Date(`${dayStr}T00:00:00Z`).getUTCDay();

    // Skip days explicitly blocked by host overrides.
    if (blockedDates.has(dayStr)) {
      dayCursor = addDaysToDateKey(dayCursor, 1);
      continue;
    }

    for (const sched of schedules) {
      const memberIntervals = (allIntervals || []).filter(
        (i: any) =>
          i.scheduleId === sched.id &&
          (i.dayOfWeek === dayOfWeek || (Array.isArray(i.days) && i.days.includes(dayOfWeek)))
      );
      const memberBookings = (allBookings || []).filter((b: any) => b.userId === sched.userId);
      const memberExternalBusy = externalBusyByUser.get(sched.userId) || [];

      const dailyBookingCount = bookingsPerUserPerDay.get(`${sched.userId}|${dayStr}`) || 0;
      if (et.maxPerDay && dailyBookingCount >= et.maxPerDay) {
        continue;
      }

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
          const slotStart = zonedLocalToUtc(dayStr, slotTime, timeZone);
          const slotEnd = new Date(slotStart.getTime() + slotLen * 60000);
          const bStart = new Date(slotStart.getTime() - bufB * 60000);
          const bEnd = new Date(slotEnd.getTime() + bufA * 60000);

          // Check this member's booking conflicts
          const localConflict = memberBookings.some((b: any) => new Date(b.startTime) < bEnd && new Date(b.endTime) > bStart);
          const externalConflict = memberExternalBusy.some((busySlot) => busySlot.start < bEnd && busySlot.end > bStart);
          const conflict = localConflict || externalConflict;

          if (!conflict) {
            const iso = slotStart.toISOString();

            // Skip slots within minimumBookingNotice window from now
            if (slotStart <= noticeCutoff) continue;

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

    dayCursor = addDaysToDateKey(dayCursor, 1);
  }

  return NextResponse.json({ status: "success", data: slotsByDay });
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}



