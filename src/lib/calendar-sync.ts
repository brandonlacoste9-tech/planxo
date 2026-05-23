import { supabase } from "@/lib/supabase";

interface BusySlot {
  start: Date;
  end: Date;
}

// ── Google Calendar event creation ──

export interface CreateGoogleCalendarEventParams {
  /** The host's Supabase userId — used to look up their stored Credential */
  userId: string;
  title: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  attendeeEmail: string;
  attendeeName?: string;
  meetingUrl?: string;
  timeZone?: string;
}

/**
 * Create a Google Calendar event on the host's primary calendar.
 * Looks up the host's stored refresh token from the Credential table,
 * exchanges it for a fresh access token, then POSTs the event.
 * Throws on error so the caller can handle it non-blocking.
 */
export async function createGoogleCalendarEvent(
  params: CreateGoogleCalendarEventParams
): Promise<any> {
  const {
    userId,
    title,
    startTime,
    endTime,
    attendeeEmail,
    attendeeName,
    meetingUrl,
    timeZone = "America/Toronto",
  } = params;

  // 1. Fetch the stored Google credential for this user
  const { data: cred, error: credErr } = await supabase
    .from("Credential")
    .select("*")
    .eq("userId", userId)
    .eq("type", "google")
    .single();

  if (credErr || !cred) {
    throw new Error(`No Google credential found for userId ${userId}`);
  }

  if (!cred.refreshToken) {
    throw new Error(`Google credential for userId ${userId} has no refresh token`);
  }

  // 2. Exchange refresh token for a fresh access token
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cred.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error || !tokenData.access_token) {
    throw new Error(
      `Failed to refresh Google access token: ${tokenData.error_description || tokenData.error}`
    );
  }

  const accessToken: string = tokenData.access_token;

  // Optionally update the stored access token + expiry so future busy-time checks work
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;
  supabase
    .from("Credential")
    .update({ accessToken, expiresAt, updatedAt: new Date().toISOString() })
    .eq("id", cred.id)
    .then(() => {})
    .catch(() => {});

  // 3. Build the Calendar event body
  const eventBody: Record<string, any> = {
    summary: title,
    start: { dateTime: startTime, timeZone },
    end: { dateTime: endTime, timeZone },
    attendees: [{ email: attendeeEmail, displayName: attendeeName || attendeeEmail }],
  };

  // If the meeting URL is a Google Meet link, attach it as conferenceData
  if (meetingUrl?.includes("meet.google.com")) {
    eventBody.conferenceData = {
      entryPoints: [
        {
          entryPointType: "video",
          uri: meetingUrl,
          label: meetingUrl,
        },
      ],
      conferenceSolution: {
        key: { type: "hangoutsMeet" },
        name: "Google Meet",
      },
    };
  } else if (meetingUrl) {
    // For Zoom, Teams, or other URLs — set as location
    eventBody.location = meetingUrl;
  }

  // 4. POST to Google Calendar API
  const calUrl = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events"
  );
  if (eventBody.conferenceData) {
    // conferenceDataVersion=1 required to persist supplied conferenceData
    calUrl.searchParams.set("conferenceDataVersion", "1");
  }
  calUrl.searchParams.set("sendUpdates", "all"); // invite attendees via email

  const calRes = await fetch(calUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  const calData = await calRes.json();
  if (!calRes.ok) {
    throw new Error(
      `Google Calendar API error ${calRes.status}: ${JSON.stringify(calData.error)}`
    );
  }

  return calData;
}

/**
 * Fetch busy times from connected external calendars.
 * Currently supports Google Calendar and Outlook (Microsoft Graph).
 * Falls back gracefully if tokens are expired or missing.
 */
export async function getExternalBusyTimes(
  userId: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusySlot[]> {
  const busy: BusySlot[] = [];

  // Get stored credentials for the user
  const { data: creds } = await supabase
    .from("Credential")
    .select("*")
    .eq("userId", userId);

  if (!creds?.length) return busy;

  for (const cred of creds) {
    try {
      if (cred.type === "google") {
        const slots = await getGoogleBusyTimes(cred.accessToken, timeMin, timeMax);
        busy.push(...slots);
      } else if (cred.type === "outlook") {
        const slots = await getOutlookBusyTimes(cred.accessToken, timeMin, timeMax);
        busy.push(...slots);
      }
    } catch (e) {
      // Token expired or API error — skip gracefully
      console.warn(`Could not fetch ${cred.type} calendar:`, e);
    }
  }

  return busy;
}

async function getGoogleBusyTimes(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusySlot[]> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: "primary" }],
      }),
    }
  );

  const data = await res.json();
  if (!data.calendars?.primary?.busy) return [];

  return data.calendars.primary.busy.map((b: any) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

async function getOutlookBusyTimes(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<BusySlot[]> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me/calendar/getSchedule",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schedules: ["primary"],
        startTime: { dateTime: timeMin.toISOString(), timeZone: "UTC" },
        endTime: { dateTime: timeMax.toISOString(), timeZone: "UTC" },
        availabilityViewInterval: 15,
      }),
    }
  );

  const data = await res.json();
  if (!data.value?.[0]?.scheduleItems) return [];

  return data.value[0].scheduleItems
    .filter((item: any) => item.status === "busy")
    .map((item: any) => ({
      start: new Date(item.start.dateTime + "Z"),
      end: new Date(item.end.dateTime + "Z"),
    }));
}
