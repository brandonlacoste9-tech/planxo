import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export async function syncGoogleCalendar(auth, calendarId) {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const res = await calendar.events.list({
      calendarId,
      timeMin: new Date().toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return res.data.items || [];
  } catch (error) {
    console.error('Error syncing Google Calendar:', error);
    throw error;
  }
}