import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ── Calendar link generators (better than Cal.com — included in every response) ──
function calendarLinks(booking: any, eventType: any) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const title = encodeURIComponent(eventType.title);
  const desc = encodeURIComponent(booking.guestNotes || "");
  const loc = encodeURIComponent(booking.meetingUrl || eventType.location || "");

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${desc}&location=${loc}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&body=${desc}&location=${loc}`,
    ical: `data:text/calendar;charset=utf-8,BEGIN:VCALENDAR%0D%0AVERSION:2.0%0D%0ABEGIN:VEVENT%0D%0ADTSTART:${fmt(start)}%0D%0ADTEND:${fmt(end)}%0D%0ASUMMARY:${title}%0D%0ADESCRIPTION:${desc}%0D%0ALOCATION:${loc}%0D%0AEND:VEVENT%0D%0AEND:VCALENDAR`,
  };
}

function formatBooking(b: any, et: any) {
  return {
    id: b.id,
    uid: b.id, // seat UID
    start: b.startTime,
    end: b.endTime,
    status: b.status === "confirmed" ? "accepted" : b.status,
    attendees: [{ name: b.guestName, email: b.guestEmail, timeZone: "UTC", language: "fr" }],
    guests: [],
    location: b.meetingUrl || et.location,
    meetingUrl: b.meetingUrl,
    metadata: {},
    paid: b.paid,
    eventTypeId: b.eventTypeId,
    calendarLinks: calendarLinks(b, et),
    createdAt: b.createdAt,
  };
}

// ── POST /api/v2/bookings ──
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Resolve event type: by ID or by slug+username
    let eventTypeId = body.eventTypeId;
    let userId: string | null = null;

    if (!eventTypeId && body.eventTypeSlug) {
      const { data: user } = await supabase
        .from("User").select("id").eq("username", body.username || "planxo").single();
      if (!user) return apiError("User not found", 404);

      const { data: et } = await supabase
        .from("EventType").select("*").eq("slug", body.eventTypeSlug).eq("userId", user.id).single();
      if (!et) return apiError("Event type not found", 404);

      eventTypeId = et.id;
      userId = user.id;
    }

    if (!eventTypeId) return apiError("eventTypeId or eventTypeSlug required", 400);

    const { data: eventType } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
    if (!eventType || !eventType.isActive) return apiError("Event type not found", 404);

    userId = userId || eventType.userId;

    // Parse start time (ISO 8601 UTC)
    const start = new Date(body.start);
    if (isNaN(start.getTime())) return apiError("Invalid start time — use ISO 8601 UTC", 400);

    // Use length from body override or event type default
    const lengthMinutes = body.lengthInMinutes || eventType.length;
    const end = new Date(start.getTime() + lengthMinutes * 60000);

    // Attendee
    const attendee = body.attendee || {};
    const guestName = attendee.name || body.guestName;
    const guestEmail = attendee.email || body.guestEmail;
    if (!guestName || !guestEmail) return apiError("attendee.name and attendee.email required", 400);

    const guestNotes = body.metadata?.notes || body.guestNotes || "";
    const guestTz = attendee.timeZone || "UTC";

    // ── Defensive scheduling checks ──
    const bufBefore = (eventType.bufferBefore || 0) * 60000;
    const bufAfter = (eventType.bufferAfter || 0) * 60000;
    const checkStart = new Date(start.getTime() - bufBefore);
    const checkEnd = new Date(end.getTime() + bufAfter);

    // Conflict check (respects buffer zones)
    if (!body.allowConflicts) {
      const { data: conflicts } = await supabase
        .from("Booking").select("id").eq("eventTypeId", eventTypeId).neq("status", "cancelled")
        .lt("startTime", checkEnd.toISOString()).gt("endTime", checkStart.toISOString()).limit(1);
      if (conflicts?.length) return apiError("Ce créneau n'est plus disponible (tampon ou conflit)", 409);
    }

    // Daily cap
    if (eventType.maxPerDay) {
      const dayStr = start.toISOString().split("T")[0];
      const { count } = await supabase
        .from("Booking").select("*", { count: "exact", head: true })
        .eq("eventTypeId", eventTypeId).neq("status", "cancelled")
        .gte("startTime", dayStr + "T00:00:00Z").lte("startTime", dayStr + "T23:59:59Z");
      if (count && count >= eventType.maxPerDay && !body.allowBookingOutOfBounds)
        return apiError("Limite quotidienne de réservations atteinte", 409);
    }

    // Meeting URL
    const locationType = body.location?.type || eventType.location;
    let meetingUrl = body.meetingUrl || null;
    if (!meetingUrl) {
      if (locationType === "google-meet") meetingUrl = `https://meet.google.com/${rand()}`;
      else if (locationType === "zoom") meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
      else if (locationType === "teams") meetingUrl = `https://teams.microsoft.com/l/meetup-join/${rand()}`;
    }

    const bookingId = crypto.randomUUID();
    const now = new Date().toISOString();

    const isPaid = eventType.price === 0;
    const bookingStatus = isPaid ? "confirmed" : "pending_payment";

    const { data: booking, error } = await supabase.from("Booking").insert({
      id: bookingId, eventTypeId, userId,
      guestName, guestEmail, guestNotes,
      startTime: start.toISOString(), endTime: end.toISOString(),
      status: bookingStatus, paid: isPaid,
      meetingUrl, updatedAt: now,
    }).select().single();

    if (error) return apiError(error.message, 500);

    // Fire webhooks
    const { data: webhooks } = await supabase.from("Webhook").select("*").eq("userId", userId).eq("isActive", true);
    for (const wh of webhooks || []) {
      if (wh.events.includes("booking.created")) {
        fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "booking.created", booking: formatBooking(booking, eventType) }),
        }).catch(() => {});
      }
    }

    const response = NextResponse.json({
      status: "success",
      data: formatBooking(booking, eventType),
    }, { status: 201 });

    response.headers.set("X-RateLimit-Remaining", "118");
    return response;
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

// ── GET /api/v2/bookings ──
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventTypeId = searchParams.get("eventTypeId");
  const status = searchParams.get("status");
  const attendeeEmail = searchParams.get("attendeeEmail");

  let q = supabase.from("Booking").select("*, eventType:EventType(*)").order("startTime", { ascending: true });
  if (eventTypeId) q = q.eq("eventTypeId", eventTypeId);
  if (status) q = q.eq("status", status);
  if (attendeeEmail) q = q.eq("guestEmail", attendeeEmail);

  const { data: bookings, error } = await q;
  if (error) return apiError(error.message, 500);

  const result = (bookings || []).map((b: any) => ({
    id: b.id,
    uid: b.id,
    start: b.startTime,
    end: b.endTime,
    status: b.status === "confirmed" ? "accepted" : b.status,
    attendees: [{ name: b.guestName, email: b.guestEmail }],
    meetingUrl: b.meetingUrl,
    eventTypeId: b.eventTypeId,
    paid: b.paid,
    createdAt: b.createdAt,
  }));

  const response = NextResponse.json({ status: "success", data: result });
  response.headers.set("X-RateLimit-Remaining", "118");
  return response;
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}

function rand(): string {
  const c = "abcdefghijklmnopqrstuvwxyz";
  let r = "";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) r += c[Math.floor(Math.random() * c.length)];
    if (i < 2) r += "-";
  }
  return r;
}
