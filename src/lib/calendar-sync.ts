import { supabase } from "@/lib/supabase";

interface BusySlot {
  start: Date;
  end: Date;
}

interface ConnectedCalendarRow {
  id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  user_id: string;
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
  locationType?: string;
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
    locationType,
    timeZone = "America/Toronto",
  } = params;

  const connected = await getConnectedCalendar(userId, "google");
  if (!connected) {
    throw new Error(`No Google calendar connected for userId ${userId}`);
  }

  const accessToken = await ensureConnectedCalendarAccessToken(connected);

  // 3. Build the Calendar event body
  const eventBody: Record<string, any> = {
    summary: title,
    start: { dateTime: startTime, timeZone },
    end: { dateTime: endTime, timeZone },
    attendees: [{ email: attendeeEmail, displayName: attendeeName || attendeeEmail }],
  };

  const normalizedLocationType = String(locationType || "").toLowerCase();
  const shouldCreateNativeMeet = !meetingUrl && normalizedLocationType.includes("google");

  // If the meeting URL is a Google Meet link, attach it as conferenceData
  if (shouldCreateNativeMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: `plx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  } else if (meetingUrl?.includes("meet.google.com")) {
    eventBody.location = meetingUrl;
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

export interface CreateOutlookCalendarEventParams {
  userId: string;
  title: string;
  startTime: string;
  endTime: string;
  attendeeEmail: string;
  attendeeName?: string;
  meetingUrl?: string;
  locationType?: string;
  timeZone?: string;
}

export async function createOutlookCalendarEvent(
  params: CreateOutlookCalendarEventParams
): Promise<any> {
  const {
    userId,
    title,
    startTime,
    endTime,
    attendeeEmail,
    attendeeName,
    meetingUrl,
    locationType,
    timeZone = "UTC",
  } = params;

  const connected = await getConnectedCalendar(userId, "outlook");
  if (!connected) {
    throw new Error(`No Outlook calendar connected for userId ${userId}`);
  }

  const accessToken = await ensureConnectedCalendarAccessToken(connected);

  const eventBody: Record<string, any> = {
    subject: title,
    body: {
      contentType: "HTML",
      content: meetingUrl ? `Meeting link: ${meetingUrl}` : "",
    },
    start: { dateTime: startTime, timeZone },
    end: { dateTime: endTime, timeZone },
    attendees: [
      {
        emailAddress: {
          address: attendeeEmail,
          name: attendeeName || attendeeEmail,
        },
        type: "required",
      },
    ],
  };

  const normalizedLocationType = String(locationType || "").toLowerCase();
  const shouldCreateNativeTeams = !meetingUrl && normalizedLocationType.includes("teams");

  if (shouldCreateNativeTeams) {
    eventBody.isOnlineMeeting = true;
    eventBody.onlineMeetingProvider = "teamsForBusiness";
  }

  if (meetingUrl) {
    eventBody.location = {
      displayName: meetingUrl,
    };
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventBody),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Outlook Calendar API error ${res.status}: ${JSON.stringify(data.error || data)}`);
  }

  return data;
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

  const { data: connected } = await supabase
    .from("connected_calendars")
    .select("id, provider, access_token, refresh_token, expires_at, user_id")
    .eq("user_id", userId);

  const connectedCalendars = (connected || []) as ConnectedCalendarRow[];
  if (!connectedCalendars.length) return busy;

  for (const cred of connectedCalendars) {
    try {
      const accessToken = await ensureConnectedCalendarAccessToken(cred);
      if (!accessToken) continue;

      if (cred.provider === "google") {
        const slots = await getGoogleBusyTimes(accessToken, timeMin, timeMax);
        busy.push(...slots);
      } else if (cred.provider === "outlook") {
        const slots = await getOutlookBusyTimes(accessToken, timeMin, timeMax);
        busy.push(...slots);
      }
    } catch (e) {
      // Token expired or API error — skip gracefully
      console.warn(`Could not fetch ${cred.provider} calendar:`, e);
    }
  }

  return busy;
}

async function getConnectedCalendar(userId: string, provider: "google" | "outlook") {
  const { data } = await supabase
    .from("connected_calendars")
    .select("id, provider, access_token, refresh_token, expires_at, user_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  return (data || null) as ConnectedCalendarRow | null;
}

function isTokenStale(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  const expMs = Date.parse(expiresAt);
  if (Number.isNaN(expMs)) return false;
  return expMs <= Date.now() + 60_000;
}

async function ensureConnectedCalendarAccessToken(cred: ConnectedCalendarRow): Promise<string> {
  const currentToken = cred.access_token || "";
  if (currentToken && !isTokenStale(cred.expires_at)) {
    return currentToken;
  }

  if (!cred.refresh_token) {
    if (!currentToken) throw new Error(`No usable token for ${cred.provider}`);
    return currentToken;
  }

  if (cred.provider === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth client credentials are missing");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: cred.refresh_token,
        grant_type: "refresh_token",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Failed to refresh Google token: ${tokenData.error_description || tokenData.error || tokenRes.status}`);
    }

    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    await supabase
      .from("connected_calendars")
      .update({ access_token: tokenData.access_token, expires_at: expiresAt })
      .eq("id", cred.id);

    return tokenData.access_token;
  }

  const clientId = process.env.OUTLOOK_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || "common";
  if (!clientId || !clientSecret) throw new Error("Outlook OAuth client credentials are missing");

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cred.refresh_token,
      grant_type: "refresh_token",
      scope: "offline_access https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Calendars.ReadWrite",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to refresh Outlook token: ${tokenData.error_description || tokenData.error || tokenRes.status}`);
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;

  await supabase
    .from("connected_calendars")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || cred.refresh_token,
      expires_at: expiresAt,
    })
    .eq("id", cred.id);

  return tokenData.access_token;
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
