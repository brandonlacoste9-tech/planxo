import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
    const idempotencyKeyHeader = request.headers.get("Idempotency-Key");
    const idempotencyKeyBody = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
    const idempotencyKey = (idempotencyKeyHeader || idempotencyKeyBody || "").trim();

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

    const ownerUserId = String(userId || eventType.userId || "");
    if (!ownerUserId) return apiError("Missing host user", 500);

    if (idempotencyKey) {
      const { data: existingBookingByIdempotency, error: idempotencyLookupError } = await supabase
        .from("Booking")
        .select("*, eventType:EventType(*)")
        .eq("eventTypeId", eventTypeId)
        .eq("userId", ownerUserId)
        .contains("metadata", { idempotencyKey })
        .order("createdAt", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (idempotencyLookupError) {
        console.warn("Idempotency lookup failed, continuing without replay check:", idempotencyLookupError.message);
      } else if (existingBookingByIdempotency) {
        const replayResponse = NextResponse.json(
          {
            status: "success",
            data: formatBooking(existingBookingByIdempotency, existingBookingByIdempotency.eventType || eventType),
          },
          { status: 200 }
        );
        replayResponse.headers.set("X-Idempotent-Replay", "true");
        replayResponse.headers.set("X-RateLimit-Remaining", "118");
        return replayResponse;
      }
    }

    const schedulingType = normalizeSchedulingType(eventType.schedulingType);
    const teamIds = (schedulingType === "round_robin" || schedulingType === "collective" || schedulingType === "pooled")
      ? normalizeTeamMembers(eventType.teamMembers, ownerUserId)
      : [ownerUserId];

    // Daily cap — keep based on event type for backwards compatibility.
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
      if (locationType?.includes("zoom")) {
        meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
      }
    }

    // ── Host-aware conflict checks + assignment ──
    let assignedUserId: string = ownerUserId;
    if (!body.allowConflicts) {
      const { data: hostConflicts } = await supabase
        .from("Booking")
        .select("id,userId")
        .neq("status", "cancelled")
        .in("userId", teamIds)
        .lt("startTime", checkEnd.toISOString())
        .gt("endTime", checkStart.toISOString());

      const conflictedHostIds = new Set((hostConflicts || []).map((b: { userId: string }) => b.userId));

      if (schedulingType === "collective") {
        if (conflictedHostIds.size > 0) {
          return apiError("Ce créneau n'est plus disponible pour toute l'équipe", 409);
        }
      } else if (schedulingType === "round_robin" || schedulingType === "pooled") {
        const availableHosts = teamIds.filter((id) => !conflictedHostIds.has(id));
        if (!availableHosts.length) {
          return apiError("Ce créneau n'est plus disponible (tampon ou conflit)", 409);
        }

        // Pick the least-loaded available host in a recent window.
        const { data: recentBookings } = await supabase
          .from("Booking")
          .select("userId")
          .neq("status", "cancelled")
          .in("userId", availableHosts)
          .gte("startTime", new Date(start.getTime() - 86400000).toISOString());

        const load: Record<string, number> = {};
        for (const id of availableHosts) load[id] = 0;
        for (const b of recentBookings || []) load[b.userId] = (load[b.userId] || 0) + 1;
        assignedUserId = availableHosts.reduce((a: string, b: string) => (load[a] ?? 0) <= (load[b] ?? 0) ? a : b);
      } else if (conflictedHostIds.has(ownerUserId)) {
        return apiError("Ce créneau n'est plus disponible (tampon ou conflit)", 409);
      }
    } else if (schedulingType === "round_robin" || schedulingType === "pooled") {
      assignedUserId = teamIds[0] || ownerUserId;
    }

    const isPaid = eventType.price === 0;
    const bookingStatus = isPaid ? "accepted" : "pending";
    const bookingId = Math.floor(Math.random() * 90000000) + 10000000; // 8-digit integer fitting PostgreSQL int4
    const bookingUid = crypto.randomUUID(); // text uid for cal.diy
    const cancelToken = crypto.randomUUID();
    const now = new Date().toISOString();

    // cal.diy Booking: attendee info in responses jsonb, not guestName/guestEmail columns
    const responses = {
      name: guestName,
      email: guestEmail,
      notes: guestNotes,
      timeZone: guestTz,
      location: locationType,
    };

    const metadataPayload: Record<string, any> =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};

    if (idempotencyKey) {
      metadataPayload.idempotencyKey = idempotencyKey;
    }

    const baseInsertPayload: Record<string, any> = {
      id: bookingId,
      uid: bookingUid,
      eventTypeId,
      userId: assignedUserId,
      title: eventType.title || `RDV avec ${guestName}`,
      guestName,
      guestEmail,
      guestNotes,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: bookingStatus,
      cancelToken,
      paid: isPaid,
      location: meetingUrl || "",
      userPrimaryEmail: guestEmail,
      responses,
      metadata: metadataPayload,
      createdAt: now,
      updatedAt: now,
    };

    const insertPayload = { ...baseInsertPayload };
    let booking: any = null;
    let lastInsertError: any = null;
    for (let attemptIndex = 0; attemptIndex < 8; attemptIndex++) {
      const attempt = await supabase.from("Booking").insert(insertPayload).select().single();
      if (!attempt.error) {
        booking = attempt.data;
        lastInsertError = null;
        break;
      }

      lastInsertError = attempt.error;
      const msg = String(attempt.error.message || "");
      const missingColumnMatch = msg.match(/Could not find the '([^']+)' column/);
      if (!missingColumnMatch) {
        break;
      }

      const missingColumn = missingColumnMatch[1];
      if (!(missingColumn in insertPayload)) {
        break;
      }
      delete insertPayload[missingColumn];
    }

    if (lastInsertError) return apiError(lastInsertError.message, 500);

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

    // ── External calendar sync (non-blocking): Google + Outlook ──
    let syncedMeetingUrl = booking.location || null;
    try {
      const { createGoogleCalendarEvent, createOutlookCalendarEvent } = await import("@/lib/calendar-sync");

      if (locationType?.includes("teams")) {
        try {
          const outlookEvent = await createOutlookCalendarEvent({
            userId: assignedUserId,
            title: `${eventType?.title || "Rendez-vous"} avec ${guestName}`,
            startTime: booking.startTime || start.toISOString(),
            endTime: booking.endTime || end.toISOString(),
            attendeeEmail: guestEmail,
            attendeeName: guestName,
            meetingUrl: syncedMeetingUrl || undefined,
            locationType,
            timeZone: "UTC",
          });
          const teamsJoin = outlookEvent?.onlineMeeting?.joinUrl;
          if (!syncedMeetingUrl && teamsJoin) syncedMeetingUrl = teamsJoin;
        } catch (outlookErr) {
          console.error("Outlook Calendar sync failed (non-blocking):", outlookErr);
        }

        try {
          await createGoogleCalendarEvent({
            userId: assignedUserId,
            title: `${eventType?.title || "Rendez-vous"} avec ${guestName}`,
            startTime: booking.startTime || start.toISOString(),
            endTime: booking.endTime || end.toISOString(),
            attendeeEmail: guestEmail,
            attendeeName: guestName,
            meetingUrl: syncedMeetingUrl || undefined,
            locationType,
            timeZone: "America/Toronto",
          });
        } catch (googleErr) {
          console.error("Google Calendar sync failed (non-blocking):", googleErr);
        }
      } else {
        try {
          const googleEvent = await createGoogleCalendarEvent({
            userId: assignedUserId,
            title: `${eventType?.title || "Rendez-vous"} avec ${guestName}`,
            startTime: booking.startTime || start.toISOString(),
            endTime: booking.endTime || end.toISOString(),
            attendeeEmail: guestEmail,
            attendeeName: guestName,
            meetingUrl: syncedMeetingUrl || undefined,
            locationType,
            timeZone: "America/Toronto",
          });
          const googleMeetLink =
            googleEvent?.hangoutLink ||
            googleEvent?.conferenceData?.entryPoints?.find((entry: any) => entry?.entryPointType === "video")?.uri;
          if (!syncedMeetingUrl && googleMeetLink) syncedMeetingUrl = googleMeetLink;
        } catch (googleErr) {
          console.error("Google Calendar sync failed (non-blocking):", googleErr);
        }

        try {
          await createOutlookCalendarEvent({
            userId: assignedUserId,
            title: `${eventType?.title || "Rendez-vous"} avec ${guestName}`,
            startTime: booking.startTime || start.toISOString(),
            endTime: booking.endTime || end.toISOString(),
            attendeeEmail: guestEmail,
            attendeeName: guestName,
            meetingUrl: syncedMeetingUrl || undefined,
            locationType,
            timeZone: "UTC",
          });
        } catch (outlookErr) {
          console.error("Outlook Calendar sync failed (non-blocking):", outlookErr);
        }
      }

      if (syncedMeetingUrl && syncedMeetingUrl !== booking.location) {
        const { data: updatedBooking } = await supabase
          .from("Booking")
          .update({ location: syncedMeetingUrl, updatedAt: new Date().toISOString() })
          .eq("id", booking.id)
          .select()
          .single();

        if (updatedBooking) {
          booking = updatedBooking;
        }
      }
    } catch (calErr) {
      console.error("External calendar sync setup failed (non-blocking):", calErr);
    }

    const response = NextResponse.json({
      status: "success",
      data: formatBooking(booking, eventType),
    }, { status: 201 });

    if (idempotencyKey) {
      response.headers.set("X-Idempotency-Key", idempotencyKey);
    }
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
