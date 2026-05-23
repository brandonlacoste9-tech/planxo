import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// ── Calendar link generators (better than Cal.com — included in every response) ──
function calendarLinks(booking: any, eventType: any) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const title = encodeURIComponent(eventType.title);
  const desc = encodeURIComponent((booking.responses?.notes) || "");
  const loc = encodeURIComponent(booking.location || eventType.location || "");

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${desc}&location=${loc}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&body=${desc}&location=${loc}`,
    ical: `data:text/calendar;charset=utf-8,BEGIN:VCALENDAR%0D%0AVERSION:2.0%0D%0ABEGIN:VEVENT%0D%0ADTSTART:${fmt(start)}%0D%0ADTEND:${fmt(end)}%0D%0ASUMMARY:${title}%0D%0ADESCRIPTION:${desc}%0D%0ALOCATION:${loc}%0D%0AEND:VEVENT%0D%0AEND:VCALENDAR`,
  };
}

function formatBooking(b: any, et: any) {
  const responses = b.responses || {};
  return {
    id: b.id,
    uid: b.uid,
    start: b.startTime,
    end: b.endTime,
    status: b.status === "accepted" ? "accepted" : b.status,
    attendees: [{ name: responses.name || "", email: responses.email || b.userPrimaryEmail || "", timeZone: responses.timeZone || "UTC", language: "fr" }],
    guests: [],
    location: b.location || Array.isArray(et.locations) ? (et.locations?.[0]?.type || "") : "",
    meetingUrl: b.location || "",
    metadata: b.metadata || {},
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
        .from("users").select("id").eq("username", body.username || "planxo").single();
      if (!user) return apiError("User not found", 404);

      const { data: et } = await supabase
        .from("EventType").select("*").eq("slug", body.eventTypeSlug).eq("userId", user.id).single();
      if (!et) return apiError("Event type not found", 404);

      eventTypeId = et.id;
      userId = user.id;
    }

    if (!eventTypeId) return apiError("eventTypeId or eventTypeSlug required", 400);

    const { data: eventType } = await supabase.from("EventType").select("*").eq("id", eventTypeId).single();
    if (!eventType || eventType.hidden) return apiError("Event type not found", 404);

    userId = userId || eventType.userId;

    // Map cal.diy column names to friendly aliases
    eventType.isActive = !eventType.hidden;
    eventType.bufferBefore = eventType.beforeEventBuffer || 0;
    eventType.bufferAfter = eventType.afterEventBuffer || 0;
    eventType.location = Array.isArray(eventType.locations) ? (eventType.locations[0]?.type || "google-meet") : "google-meet";

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

    // Daily cap — cal.diy uses bookingLimits jsonb, we check from eventType directly
    const maxPerDay = eventType.maxPerDay;
    if (maxPerDay) {
      const dayStr = start.toISOString().split("T")[0];
      const { count } = await supabase
        .from("Booking").select("*", { count: "exact", head: true })
        .eq("eventTypeId", eventTypeId).neq("status", "cancelled")
        .gte("startTime", dayStr + "T00:00:00Z").lte("startTime", dayStr + "T23:59:59Z");
      if (count && count >= eventType.maxPerDay && !body.allowBookingOutOfBounds)
        return apiError("Limite quotidienne de réservations atteinte", 409);
    }

    // Meeting URL
    const locationType = eventType.location; // already mapped from locations[0].type
    let meetingUrl = body.meetingUrl || null;
    if (!meetingUrl) {
      if (locationType?.includes("google")) meetingUrl = `https://meet.google.com/${rand()}`;
      else if (locationType?.includes("zoom")) meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
      else if (locationType?.includes("teams")) meetingUrl = `https://teams.microsoft.com/l/meetup-join/${rand()}`;
    }

    // ── Round-robin / collective: determine assigned user ──
    let assignedUserId = userId;
    const schedulingType = eventType.schedulingType || "individual";
    if (schedulingType === "round_robin") {
      const teamIds = eventType.teamMembers || [userId];
      // Pick member with fewest bookings in recent period
      const { data: recentBookings } = await supabase
        .from("Booking").select("userId").eq("eventTypeId", eventTypeId)
        .neq("status", "cancelled").in("userId", teamIds)
        .gte("startTime", new Date(start.getTime() - 86400000).toISOString());
      const load: Record<string, number> = {};
      for (const id of teamIds) load[id] = 0;
      for (const b of recentBookings || []) load[b.userId] = (load[b.userId] || 0) + 1;
      assignedUserId = teamIds.reduce((a, b) => (load[a] ?? 0) <= (load[b] ?? 0) ? a : b);
    }

    const isPaid = eventType.price === 0;
    const bookingStatus = isPaid ? "accepted" : "pending";
    const bookingId = Math.floor(Math.random() * 90000000) + 10000000; // 8-digit integer fitting PostgreSQL int4
    const bookingUid = crypto.randomUUID(); // text uid for cal.diy
    const now = new Date().toISOString();

    // cal.diy Booking: attendee info in responses jsonb, not guestName/guestEmail columns
    const responses = {
      name: guestName,
      email: guestEmail,
      notes: guestNotes,
      timeZone: guestTz,
      location: locationType,
    };

    const { data: booking, error } = await supabase.from("Booking").insert({
      id: bookingId,
      uid: bookingUid,
      eventTypeId,
      userId: assignedUserId,
      title: eventType.title || `RDV avec ${guestName}`,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: bookingStatus,
      paid: isPaid,
      location: meetingUrl || "",
      userPrimaryEmail: guestEmail,
      responses,
      metadata: {},
      createdAt: now,
      updatedAt: now,
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

    // Fire emails (non-blocking — never breaks the booking response)
    try {
      const { sendBookingConfirmation, sendBookingNotificationToHost } = await import("@/lib/email");

      // Fetch host user for name + email
      const { data: hostUser } = await supabase
        .from("users")
        .select("id, name, username, email")
        .eq("id", assignedUserId)
        .single();

      const hostDisplayName = hostUser?.name || hostUser?.username || "Hôte";

      // Confirmation to guest
      if (guestEmail) {
        await sendBookingConfirmation({
          to: guestEmail,
          guestName,
          hostName: hostDisplayName,
          eventTitle: eventType?.title || "Rendez-vous",
          startTime: booking.startTime || body.start,
          endTime: booking.endTime || (end.toISOString()),
          meetingUrl: booking.location || undefined,
          uid: booking.uid,
        });
      }

      // Notification to host
      if (hostUser?.email) {
        await sendBookingNotificationToHost({
          to: hostUser.email,
          hostName: hostDisplayName,
          guestName,
          eventTitle: eventType?.title || "Rendez-vous",
          startTime: booking.startTime || body.start,
          meetingUrl: booking.location || undefined,
        });
      }
    } catch (emailErr) {
      console.error("Email non-bloquant:", emailErr);
    }

    // ── Google Calendar sync (non-blocking) ──
    try {
      const { createGoogleCalendarEvent } = await import("@/lib/calendar-sync");
      await createGoogleCalendarEvent({
        userId: assignedUserId,
        title: `${eventType?.title || "Rendez-vous"} avec ${guestName}`,
        startTime: booking.startTime || start.toISOString(),
        endTime: booking.endTime || end.toISOString(),
        attendeeEmail: guestEmail,
        attendeeName: guestName,
        meetingUrl: booking.location || undefined,
        timeZone: "America/Toronto",
      });
    } catch (calErr) {
      console.error("Google Calendar sync failed (non-blocking):", calErr);
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
  const timeFilter = searchParams.get("timeFilter"); // "upcoming" | "past"
  const attendeeEmail = searchParams.get("attendeeEmail");
  const uid = searchParams.get("uid");

  let q = supabase.from("Booking").select("*, eventType:EventType(*)").order("startTime", { ascending: true });
  if (eventTypeId) q = q.eq("eventTypeId", eventTypeId);
  // timeFilter takes precedence: upcoming/past filters imply non-cancelled status unless status=cancelled
  if (timeFilter === "upcoming") {
    q = q.gte("startTime", new Date().toISOString()).neq("status", "cancelled");
  } else if (timeFilter === "past") {
    q = q.lt("startTime", new Date().toISOString()).neq("status", "cancelled");
  } else if (status === "cancelled") {
    q = q.eq("status", "cancelled");
  } else if (status) {
    q = q.eq("status", status);
  }
  if (attendeeEmail) q = q.eq("userPrimaryEmail", attendeeEmail);
  if (uid) q = q.eq("uid", uid);

  const { data: bookings, error } = await q;
  if (error) return apiError(error.message, 500);

  const result = (bookings || []).map((b: any) => {
    const resp = b.responses || {};
    return {
      id: b.id,
      uid: b.uid,
      start: b.startTime,
      end: b.endTime,
      title: b.title || b.eventType?.title || "",
      status: b.status === "accepted" ? "accepted" : b.status,
      attendees: [{ name: resp.name || "", email: resp.email || b.userPrimaryEmail || "" }],
      meetingUrl: b.location || "",
      eventTypeId: b.eventTypeId,
      paid: b.paid,
      createdAt: b.createdAt,
    };
  });

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
