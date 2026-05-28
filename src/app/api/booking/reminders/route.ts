import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getEnvVar, validateCoreEnv } from '@/lib/env';

type ReminderPreferences = {
  email24h?: {
    enabled: boolean;
    subject?: string;
    body?: string;
  };
  sms2h?: {
    enabled: boolean;
    message?: string;
  };
};

const DEFAULT_TEMPLATES = {
  email24h: {
    subject: 'Rappel : Votre rendez-vous de demain',
    body: 'Bonjour {{name}},\n\nCeci est un rappel pour votre rendez-vous avec {{professional}} le {{date}} à {{time}}.\n\nCordialement,\n{{professional}}',
  },
  sms2h: {
    message: 'Rappel : RDV avec {{professional}} dans 2h à {{time}}. {{date}}',
  },
};

function hasTwilioSmsConfig() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

function formatDateTimeInZone(date: Date, timeZone: string) {
  return {
    date: date.toLocaleDateString('fr-CA', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('fr-CA', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  };
}

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] || '');
}

function toPlainObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

async function sendSmsReminder(to: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const body = new URLSearchParams({ To: to, From: from, Body: message });
  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Twilio SMS error: ${err}`);
  }
}

function reminderKey(bookingId: string, reminderType: string) {
  return `${bookingId}:${reminderType}`;
}

function isMissingOnConflictConstraintError(error: any) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('on conflict') && message.includes('constraint');
}

async function claimReminderSend(params: {
  bookingId: string;
  reminderType: '24h' | 'sms2h';
  recipient: string;
  runClaims: Set<string>;
}) {
  const { bookingId, reminderType, recipient, runClaims } = params;
  const claimKey = reminderKey(bookingId, reminderType);
  if (runClaims.has(claimKey)) {
    return null;
  }

  runClaims.add(claimKey);
  const claimTimestamp = new Date().toISOString();

  const reminderRecord = {
    booking_id: bookingId,
    reminder_type: reminderType,
    sent_at: claimTimestamp,
    recipient_email: recipient,
  };

  const upsertAttempt = await supabase
    .from('email_reminders')
    .upsert(reminderRecord, { onConflict: 'booking_id,reminder_type', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();

  if (!upsertAttempt.error) {
    if (!upsertAttempt.data) {
      return null;
    }

    return { claimTimestamp, claimKey };
  }

  if (!isMissingOnConflictConstraintError(upsertAttempt.error)) {
    throw new Error(upsertAttempt.error.message || 'Unable to claim reminder send');
  }

  const existing = await supabase
    .from('email_reminders')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('reminder_type', reminderType)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(existing.error.message || 'Failed to verify existing reminder claim');
  }
  if (existing.data) {
    return null;
  }

  const insertAttempt = await supabase.from('email_reminders').insert(reminderRecord);
  if (insertAttempt.error) {
    if (String(insertAttempt.error.code || '') === '23505') {
      return null;
    }
    throw new Error(insertAttempt.error.message || 'Unable to create reminder claim');
  }

  return { claimTimestamp, claimKey };
}

async function releaseReminderClaim(bookingId: string, reminderType: '24h' | 'sms2h', claimTimestamp: string) {
  await supabase
    .from('email_reminders')
    .delete()
    .eq('booking_id', bookingId)
    .eq('reminder_type', reminderType)
    .eq('sent_at', claimTimestamp);
}

// Email reminder cron job - runs every hour
export async function POST(request: NextRequest) {
  try {
    validateCoreEnv();
    const appUrl = getEnvVar('NEXT_PUBLIC_APP_URL', 'booking-reminders');
    const internalApiKey = getEnvVar('INTERNAL_API_KEY', 'booking-reminders');
    const cronSecret = getEnvVar('CRON_SECRET', 'booking-reminders');

    // Verify cron secret
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      emailsSent: 0,
      smsSent: 0,
      emailSkipped: 0,
      smsSkipped: 0,
      errors: 0,
      bookingsScanned: 0,
      emailWindowCandidates: 0,
      smsWindowCandidates: 0,
      details: [] as any[]
    };

    const now = new Date();
    
    // Gather bookings between now+1h and now+25h to evaluate both 24h email and 2h SMS channels.
    const windowStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: bookings, error } = await supabase
      .from('Booking')
      .select('*')
      .gte('startTime', windowStart.toISOString())
      .lte('startTime', windowEnd.toISOString())
      .in('status', ['accepted', 'confirmed', 'ACCEPTED', 'CONFIRMED', 'RESCHEDULED', 'rescheduled']);

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    const eventTypeCache = new Map<string, any>();
    const userCache = new Map<string, any>();
    const runClaims = new Set<string>();

    for (const booking of bookings || []) {
      try {
        results.bookingsScanned++;
        const bookingStart = new Date(booking.startTime);
        const msUntilBooking = bookingStart.getTime() - now.getTime();
        const emailWindow = msUntilBooking >= 23 * 3600000 && msUntilBooking <= 25 * 3600000;
        const smsWindow = msUntilBooking >= 1 * 3600000 && msUntilBooking <= 3 * 3600000;

        if (emailWindow) results.emailWindowCandidates++;
        if (smsWindow) results.smsWindowCandidates++;

        let eventType = eventTypeCache.get(String(booking.eventTypeId));
        if (!eventType) {
          const { data } = await supabase
            .from('EventType')
            .select('id,title,userId')
            .eq('id', booking.eventTypeId)
            .single();
          eventType = data;
          if (eventType) eventTypeCache.set(String(booking.eventTypeId), eventType);
        }
        if (!eventType?.userId) continue;

        let user = userCache.get(String(eventType.userId));
        if (!user) {
          const { data } = await supabase
            .from('users')
            .select('id,name,email,timeZone,reminderPreferences')
            .eq('id', eventType.userId)
            .single();
          user = data;
          if (user) userCache.set(String(eventType.userId), user);
        }
        if (!user) continue;

        const prefs = (user.reminderPreferences || {}) as ReminderPreferences;
        const emailPrefs = {
          enabled: prefs.email24h?.enabled ?? true,
          subject: prefs.email24h?.subject || DEFAULT_TEMPLATES.email24h.subject,
          body: prefs.email24h?.body || DEFAULT_TEMPLATES.email24h.body,
        };
        const smsPrefs = {
          enabled: prefs.sms2h?.enabled ?? false,
          message: prefs.sms2h?.message || DEFAULT_TEMPLATES.sms2h.message,
        };

        const bookingResponses = toPlainObject(booking.responses);
        const attendeeEmail = bookingResponses.email || booking.guestEmail;
        const attendeePhone = booking.smsReminderNumber || bookingResponses.phone || bookingResponses.phoneNumber;
        const attendeeName = bookingResponses.name || booking.guestName || 'there';
        const attendeeTz = bookingResponses.timeZone || user.timeZone || 'America/Toronto';
        const { date, time } = formatDateTimeInZone(bookingStart, attendeeTz);

        const templateVars = {
          name: attendeeName,
          professional: user.name || 'Planxo',
          date,
          time,
        };

        if (emailWindow && emailPrefs.enabled && attendeeEmail) {
          const bookingId = String(booking.id);
          const claim = await claimReminderSend({
            bookingId,
            reminderType: '24h',
            recipient: attendeeEmail,
            runClaims,
          });

          if (claim) {
            try {
              const renderedSubject = renderTemplate(emailPrefs.subject, templateVars);
              const renderedBody = renderTemplate(emailPrefs.body, templateVars);
              const emailResponse = await fetch(`${appUrl}/api/email/send`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${internalApiKey}`,
                },
                body: JSON.stringify({
                  to: attendeeEmail,
                  template: 'generic',
                  data: {
                    subject: renderedSubject,
                    message: renderedBody,
                  },
                }),
              });

              if (!emailResponse.ok) {
                throw new Error('Email API failed');
              }

              results.emailsSent++;
              results.details.push({ bookingId: booking.id, channel: 'email24h', recipient: attendeeEmail, status: 'sent' });
            } catch (sendError) {
              await releaseReminderClaim(bookingId, '24h', claim.claimTimestamp);
              throw sendError;
            }
          } else {
            results.emailSkipped++;
            results.details.push({ bookingId: booking.id, channel: 'email24h', status: 'skipped', reason: 'already_sent_or_claimed' });
          }
        } else if (emailWindow) {
          results.emailSkipped++;
          const reason = !emailPrefs.enabled ? 'email_disabled' : 'missing_email';
          results.details.push({ bookingId: booking.id, channel: 'email24h', status: 'skipped', reason });
        }

        if (smsWindow && smsPrefs.enabled) {
          if (!hasTwilioSmsConfig()) {
            results.smsSkipped++;
            results.details.push({ bookingId: booking.id, channel: 'sms2h', status: 'skipped', reason: 'twilio_not_configured' });
          } else if (!attendeePhone) {
            results.smsSkipped++;
            results.details.push({ bookingId: booking.id, channel: 'sms2h', status: 'skipped', reason: 'missing_phone' });
          } else {
            const bookingId = String(booking.id);
            const claim = await claimReminderSend({
              bookingId,
              reminderType: 'sms2h',
              recipient: attendeePhone,
              runClaims,
            });

            if (claim) {
              try {
                const smsMessage = renderTemplate(smsPrefs.message, templateVars);
                await sendSmsReminder(attendeePhone, smsMessage);

                results.smsSent++;
                results.details.push({ bookingId: booking.id, channel: 'sms2h', recipient: attendeePhone, status: 'sent' });
              } catch (sendError) {
                await releaseReminderClaim(bookingId, 'sms2h', claim.claimTimestamp);
                throw sendError;
              }
            } else {
              results.smsSkipped++;
              results.details.push({ bookingId: booking.id, channel: 'sms2h', status: 'skipped', reason: 'already_sent_or_claimed' });
            }
          }
        } else if (smsWindow) {
          results.smsSkipped++;
          results.details.push({ bookingId: booking.id, channel: 'sms2h', status: 'skipped', reason: 'sms_disabled' });
        }

      } catch (err) {
        console.error(`Error sending reminder for booking ${booking.id}:`, err);
        results.errors++;
        results.details.push({
          bookingId: booking.id,
          status: 'error',
          error: String(err)
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        bookingsScanned: results.bookingsScanned,
        emailWindowCandidates: results.emailWindowCandidates,
        smsWindowCandidates: results.smsWindowCandidates,
        emailsSent: results.emailsSent,
        emailSkipped: results.emailSkipped,
        smsSent: results.smsSent,
        smsSkipped: results.smsSkipped,
        errors: results.errors,
      }
    });

  } catch (error) {
    console.error('Reminder cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for manual triggering
export async function GET(request: NextRequest) {
  validateCoreEnv();

  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const cronSecret = getEnvVar('CRON_SECRET', 'booking-reminders');
  
  if (secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return POST(request);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}
