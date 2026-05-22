import { supabase } from "@/lib/supabase";

interface BusySlot {
  start: Date;
  end: Date;
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
