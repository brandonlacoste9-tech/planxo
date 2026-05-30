import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";
import { sendBookingConfirmation, sendBookingNotificationToHost } from "@/lib/email";
import { createZoomMeeting, createGoogleCalendarEvent, createOutlookCalendarEvent } from "@/lib/calendar-sync";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${e.message}` }, { status: 400 });
  }

  // Handle checkout.session.completed — create the booking
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata;
    if (!meta) return NextResponse.json({ error: "No metadata" }, { status: 400 });

    const bookingUid = crypto.randomUUID();
    const cancelToken = crypto.randomUUID();
    const now = new Date().toISOString();

    // Generate meeting URL
    const locationType = meta.locationType || "google-meet";
    const normalizedLocationType = locationType.toLowerCase();
    let meetingUrl: string | null = null;

    if (normalizedLocationType.includes("google")) {
      // Placeholder meet URL — the real one comes back from createGoogleCalendarEvent
      // (non-blocking) which attaches native conferenceData when no URL is supplied.
      const meetCode = [4, 3, 3]
        .map((n) =>
          Array.from(
            { length: n },
            () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]
          ).join("")
        )
        .join("-");
      meetingUrl = `https://meet.google.com/${meetCode}`;
    }
    // Zoom / Teams URLs are generated via real provider calls after the booking insert.
    // Phone needs no URL.

    const eventTitle = meta.eventTitle || "Rendez-vous";

    const responses = {
      name: meta.guestName,
      email: meta.guestEmail,
      timeZone: meta.guestTimezone || "America/Toronto",
      notes: meta.guestNotes || "",
    };

    const baseInsertPayload: Record<string, any> = {
      uid: bookingUid,
      eventTypeId: meta.eventTypeId,
      userId: meta.userId,
      title: `${eventTitle} avec ${meta.guestName}`,
      guestName: meta.guestName,
      guestEmail: meta.guestEmail,
      guestNotes: meta.guestNotes || "",
      startTime: meta.startTime,
      endTime: meta.endTime,
      status: "confirmed",
      paid: true,
      cancelToken,
      responses,
      meetingUrl,
      updatedAt: now,
    };

    // Same resilient insert pattern as /api/v2/bookings:
    // try with all columns, then strip unknown ones if the DB rejects them.
    let booking: any = null;
    const insertPayload = { ...baseInsertPayload };

    for (let attempt = 0; attempt < 8; attempt++) {
      const { data, error: insertError } = await supabase
        .from("Booking")
        .insert(insertPayload)
        .select()
        .single();

      if (!insertError) {
        booking = data;
        break;
      }

      const msg = String(insertError.message || "");
      const missingColumn =
        msg.match(/Could not find the '([^']+)' column/)?.[1] ||
        msg.match(/column "([^"]+)" of relation/)?.[1];

      if (missingColumn && missingColumn in insertPayload) {
        delete insertPayload[missingColumn];
        continue;
      }

      console.error("Failed to create booking:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: "Failed to create booking after retries" }, { status: 500 });
    }

    // ── Real meeting URL generation for Zoom / Teams ──
    const durationMinutes = (() => {
      const fromMeta = parseInt(meta.lengthMinutes || "", 10);
      if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
      const startMs = Date.parse(meta.startTime || "");
      const endMs = Date.parse(meta.endTime || "");
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
        return Math.max(1, Math.round((endMs - startMs) / 60000));
      }
      return 30;
    })();

    if (normalizedLocationType.includes("zoom")) {
      try {
        const zoomMeeting = await createZoomMeeting({
          userId: meta.userId,
          title: eventTitle,
          startTime: meta.startTime,
          durationMinutes,
          timeZone: meta.guestTimezone || "America/Toronto",
        });
        if (zoomMeeting?.join_url) {
          meetingUrl = zoomMeeting.join_url;
        } else {
          meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
        }
      } catch (zoomErr) {
        console.warn("Zoom meeting creation failed:", zoomErr);
        meetingUrl = `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
      }
    } else if (normalizedLocationType.includes("teams")) {
      try {
        const outlookEvent = await createOutlookCalendarEvent({
          userId: meta.userId,
          title: eventTitle,
          startTime: meta.startTime,
          endTime: meta.endTime,
          attendeeEmail: meta.guestEmail,
          attendeeName: meta.guestName,
          locationType,
          timeZone: meta.guestTimezone || "America/Toronto",
        });
        const teamsJoin = outlookEvent?.onlineMeeting?.joinUrl;
        if (teamsJoin) meetingUrl = teamsJoin;
      } catch (teamsErr) {
        console.warn("Teams meeting creation failed:", teamsErr);
      }
    } else if (normalizedLocationType.includes("phone")) {
      meetingUrl = null;
    }

    // Persist the resolved meeting URL on the booking.
    if (meetingUrl) {
      await supabase.from("Booking").update({ location: meetingUrl, meetingUrl }).eq("uid", bookingUid);
    }

    // Look up host user for confirmation/notification emails
    const { data: hostUser } = await supabase
      .from("users")
      .select("name, username, email")
      .eq("id", meta.userId)
      .single();
    const hostDisplayName = hostUser?.name || hostUser?.username || "Hôte";

    // Send confirmation email to guest (non-blocking)
    try {
      await sendBookingConfirmation({
        to: meta.guestEmail,
        guestName: meta.guestName,
        hostName: hostDisplayName,
        eventTitle,
        startTime: meta.startTime,
        endTime: meta.endTime,
        meetingUrl: meetingUrl || undefined,
        uid: bookingUid,
      });
    } catch (emailErr) {
      console.warn("Email send failed:", emailErr);
    }

    // Notify host (non-blocking)
    if (hostUser?.email) {
      try {
        await sendBookingNotificationToHost({
          to: hostUser.email,
          hostName: hostDisplayName,
          guestName: meta.guestName,
          eventTitle,
          startTime: meta.startTime,
          meetingUrl: meetingUrl || undefined,
        });
      } catch (emailErr) {
        console.warn("Host notification email failed:", emailErr);
      }
    }

    // Create Google Calendar event. For google-meet, omit the placeholder so the
    // calendar creates a native Meet link via conferenceData, then persist the real one.
    const isGoogleMeet = normalizedLocationType.includes("google");
    try {
      const googleEvent = await createGoogleCalendarEvent({
        userId: meta.userId,
        title: eventTitle,
        startTime: meta.startTime,
        endTime: meta.endTime,
        attendeeEmail: meta.guestEmail,
        attendeeName: meta.guestName,
        meetingUrl: isGoogleMeet ? undefined : meetingUrl || undefined,
        locationType: meta.locationType || undefined,
      });

      if (isGoogleMeet) {
        const realMeetLink =
          googleEvent?.hangoutLink ||
          googleEvent?.conferenceData?.entryPoints?.find(
            (entry: any) => entry?.entryPointType === "video"
          )?.uri;
        if (realMeetLink && realMeetLink !== meetingUrl) {
          meetingUrl = realMeetLink;
          await supabase
            .from("Booking")
            .update({ location: meetingUrl, meetingUrl })
            .eq("uid", bookingUid);
        }
      }
    } catch (err) {
      console.warn("Calendar event creation failed:", err);
    }

    // Fire webhooks if any
    const { data: webhooks } = await supabase
      .from("Webhook")
      .select("*")
      .eq("userId", meta.userId)
      .eq("isActive", true);

    for (const wh of webhooks || []) {
      if (wh.events.includes("booking.created")) {
        fetch(wh.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "booking.created",
            booking: { id: booking.id, uid: bookingUid, guestName: meta.guestName, start: meta.startTime, paid: true },
          }),
        }).catch(() => {});
      }
    }

    return NextResponse.json({ status: "success", data: { bookingId: booking.id, uid: bookingUid } });
  }

  // Handle other events
  return NextResponse.json({ status: "received", type: event.type });
}
