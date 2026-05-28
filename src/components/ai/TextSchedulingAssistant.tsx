'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { themes } from '@/lib/theme';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
};

type PublicBookingResponse = {
  status?: string;
  data?: {
    title?: string;
    length?: number;
    description?: string;
    user?: {
      name?: string;
      username?: string;
      timeZone?: string;
    };
  };
  error?: string;
};

type SlotsResponse = {
  status?: string;
  data?: Record<string, string[]>;
  error?: {
    message?: string;
  };
};

type BookResponse = {
  status?: string;
  data?: {
    id?: number;
    uid?: string;
    start?: string;
    end?: string;
    meetingUrl?: string;
  };
  error?: {
    message?: string;
  };
};

type MeResponse = {
  username?: string | null;
  timeZone?: string | null;
  eventTypes?: Array<{ slug?: string | null; isActive?: boolean | null }>;
  schedules?: Array<{ intervals?: unknown[] }>;
};

type ProfileDefaults = {
  username: string;
  eventTypeSlug: string;
  timeZone: string;
  activeEventTypeCount: number;
  hasAvailability: boolean;
  availabilityKnown: boolean;
  source: 'authenticated' | 'public';
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateInputValue(dateInput: string, days: number) {
  const date = new Date(`${dateInput}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatSlotForDisplay(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString('en-CA', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone,
  });
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function TextSchedulingAssistant({
  defaultUsername = 'planxo',
  defaultEventTypeSlug = '',
}: {
  defaultUsername?: string;
  defaultEventTypeSlug?: string;
}) {
  const palette = themes.cognac;
  const userEditedUsernameRef = useRef(false);
  const userEditedEventSlugRef = useRef(false);
  const userEditedTimeZoneRef = useRef(false);
  const attemptedProvisionRef = useRef(false);
  const attemptedAvailabilityProvisionRef = useRef(false);
  const [username, setUsername] = useState(defaultUsername);
  const [eventTypeSlug, setEventTypeSlug] = useState(defaultEventTypeSlug);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()));
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');
  const [selectedStart, setSelectedStart] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [eventTitle, setEventTitle] = useState('Discovery Call');
  const [eventLength, setEventLength] = useState<number>(30);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [sameDayOnly, setSameDayOnly] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createId(),
      role: 'assistant',
      text: 'Text scheduling is ready. Pick a date, load times, and confirm a booking.',
    },
  ]);

  const canBook = useMemo(() => {
    return Boolean(selectedStart && guestName.trim() && guestEmail.trim());
  }, [selectedStart, guestName, guestEmail]);

  const addMessage = (role: ChatMessage['role'], text: string) => {
    setMessages((prev) => [...prev, { id: createId(), role, text }]);
  };

  const provisionDefaultEventType = useCallback(async () => {
    if (attemptedProvisionRef.current) return null;
    attemptedProvisionRef.current = true;

    try {
      const slug = `quick-call-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch('/api/v2/event-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Quick Call',
          slug,
          length: 30,
          location: 'google-meet',
        }),
      });

      if (!res.ok) return null;
      const payload = (await res.json()) as { data?: { slug?: string } };
      return payload.data?.slug || slug;
    } catch {
      return null;
    }
  }, []);

  const provisionDefaultAvailability = useCallback(async (timeZoneHint: string) => {
    if (attemptedAvailabilityProvisionRef.current) return false;
    attemptedAvailabilityProvisionRef.current = true;

    try {
      const res = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleName: 'Working Hours',
          timezone: timeZoneHint || 'America/Toronto',
          intervals: [
            {
              days: [1, 2, 3, 4, 5],
              startTime: '09:00:00',
              endTime: '17:00:00',
              isActive: true,
            },
          ],
        }),
      });

      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const getProfileDefaults = useCallback(async (usernameHint?: string): Promise<ProfileDefaults | null> => {
    const endpoints = ['/api/v2/me'];
    if (usernameHint) {
      endpoints.push(`/api/v2/me?username=${encodeURIComponent(usernameHint)}`);
    }

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) continue;

        let data = (await res.json()) as MeResponse;
        const isAuthenticatedProfile = endpoint === '/api/v2/me' && !usernameHint;
        const activeEventTypeCount = Array.isArray(data.eventTypes) ? data.eventTypes.length : 0;
        const schedules = Array.isArray(data.schedules) ? data.schedules : [];
        const hasAvailability = schedules.some((schedule) => Array.isArray(schedule?.intervals) && schedule.intervals.length > 0);

        let suggestedSlug =
          data.eventTypes?.find((eventType) => eventType?.isActive !== false && typeof eventType?.slug === 'string' && eventType.slug.length > 0)
            ?.slug ||
          data.eventTypes?.find((eventType) => typeof eventType?.slug === 'string' && eventType.slug.length > 0)?.slug ||
          '';

        if (!suggestedSlug && isAuthenticatedProfile) {
          const provisionedSlug = await provisionDefaultEventType();
          if (provisionedSlug) {
            suggestedSlug = provisionedSlug;
          }
        }

        if (isAuthenticatedProfile && !hasAvailability) {
          const didProvision = await provisionDefaultAvailability(data.timeZone || 'America/Toronto');
          if (didProvision) {
            const refreshedRes = await fetch('/api/v2/me', { cache: 'no-store' });
            if (refreshedRes.ok) {
              data = (await refreshedRes.json()) as MeResponse;
            }
          }
        }

        const refreshedActiveEventTypeCount = Array.isArray(data.eventTypes) ? data.eventTypes.length : activeEventTypeCount;
        const refreshedSchedules = Array.isArray(data.schedules) ? data.schedules : [];
        const refreshedHasAvailability = refreshedSchedules.some(
          (schedule) => Array.isArray(schedule?.intervals) && schedule.intervals.length > 0
        );

        const resolvedUsername = data.username || usernameHint || '';
        if (!resolvedUsername && !suggestedSlug && !data.timeZone && activeEventTypeCount === 0) {
          continue;
        }

        return {
          username: resolvedUsername,
          eventTypeSlug: suggestedSlug,
          timeZone: data.timeZone || '',
          activeEventTypeCount: refreshedActiveEventTypeCount,
          hasAvailability: refreshedHasAvailability,
          availabilityKnown: isAuthenticatedProfile,
          source: isAuthenticatedProfile ? 'authenticated' : 'public',
        };
      } catch {
        // Try next endpoint candidate.
      }
    }

    return null;
  }, [provisionDefaultAvailability, provisionDefaultEventType]);

  const pickSlotsForDate = (slotMap: Record<string, string[]> | undefined, selectedDateKey: string) => {
    if (!slotMap) {
      return { slots: [] as string[], matchedDateKey: selectedDateKey };
    }

    const direct = slotMap[selectedDateKey] || [];
    if (direct.length) {
      return { slots: direct, matchedDateKey: selectedDateKey };
    }

    const entries = Object.entries(slotMap).filter(([, slots]) => Array.isArray(slots) && slots.length > 0);
    if (!entries.length) {
      return { slots: [] as string[], matchedDateKey: selectedDateKey };
    }

    if (entries.length === 1) {
      return { slots: entries[0][1], matchedDateKey: entries[0][0] };
    }

    const selectedMs = Date.parse(`${selectedDateKey}T00:00:00Z`);
    if (Number.isNaN(selectedMs)) {
      return { slots: entries[0][1], matchedDateKey: entries[0][0] };
    }

    let nearestDateKey = selectedDateKey;
    let nearestSlots: string[] = [];
    let nearestDiff = Number.POSITIVE_INFINITY;

    for (const [key, slots] of entries) {
      const keyMs = Date.parse(`${key}T00:00:00Z`);
      if (Number.isNaN(keyMs)) continue;
      const diff = Math.abs(keyMs - selectedMs);
      if (diff < nearestDiff) {
        nearestDiff = diff;
        nearestDateKey = key;
        nearestSlots = slots;
      }
    }

    if (nearestSlots.length && nearestDiff <= 36 * 60 * 60 * 1000) {
      return { slots: nearestSlots, matchedDateKey: nearestDateKey };
    }

    return { slots: [] as string[], matchedDateKey: selectedDateKey };
  };

  const loadSlotsForDate = async (usernameToUse: string, eventTypeSlugToUse: string, timeZoneToUse: string) => {
    const startTime = `${selectedDate}T00:00:00.000Z`;
    const endDate = new Date(`${selectedDate}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endTime = endDate.toISOString();

    const slotsUrl = `/api/v2/slots?username=${encodeURIComponent(usernameToUse)}&eventTypeSlug=${encodeURIComponent(eventTypeSlugToUse)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&timeZone=${encodeURIComponent(timeZoneToUse)}`;
    const res = await fetch(slotsUrl);
    const data = (await res.json()) as SlotsResponse;

    if (!res.ok || data.status !== 'success') {
      throw new Error(data.error?.message || 'Could not load availability.');
    }

    return pickSlotsForDate(data.data, selectedDate);
  };

  const loadNextAvailableSlots = async (
    usernameToUse: string,
    eventTypeSlugToUse: string,
    timeZoneToUse: string,
    lookAheadDays = 14
  ) => {
    const startTime = `${selectedDate}T00:00:00.000Z`;
    const endDay = addDaysToDateInputValue(selectedDate, lookAheadDays);
    const endTime = `${endDay}T23:59:59.999Z`;

    const slotsUrl = `/api/v2/slots?username=${encodeURIComponent(usernameToUse)}&eventTypeSlug=${encodeURIComponent(eventTypeSlugToUse)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&timeZone=${encodeURIComponent(timeZoneToUse)}`;
    const res = await fetch(slotsUrl);
    const data = (await res.json()) as SlotsResponse;

    if (!res.ok || data.status !== 'success') {
      throw new Error(data.error?.message || 'Could not load availability.');
    }

    const entries = Object.entries(data.data || {})
      .filter(([, slots]) => Array.isArray(slots) && slots.length > 0)
      .sort(([a], [b]) => a.localeCompare(b));

    for (const [dateKey, slots] of entries) {
      if (dateKey >= selectedDate) {
        return { slots, dateKey };
      }
    }

    return { slots: [] as string[], dateKey: selectedDate };
  };

  useEffect(() => {
    let mounted = true;

    const hydrateDefaults = async () => {
      const defaults = await getProfileDefaults();
      if (!mounted || !defaults) return;

      if (!userEditedUsernameRef.current && defaults.username) {
        setUsername(defaults.username);
      }
      if (!userEditedEventSlugRef.current && defaults.eventTypeSlug) {
        setEventTypeSlug(defaults.eventTypeSlug);
      }
      if (!userEditedTimeZoneRef.current && defaults.timeZone) {
        setTimeZone(defaults.timeZone);
      }
    };

    hydrateDefaults();
    return () => {
      mounted = false;
    };
  }, [getProfileDefaults]);

  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < 720);
    };

    onResize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const loadEventContext = async (usernameToUse: string, eventTypeSlugToUse: string) => {
    const url = `/api/v2/public-booking?username=${encodeURIComponent(usernameToUse)}&eventSlug=${encodeURIComponent(eventTypeSlugToUse)}`;
    const res = await fetch(url);
    const data = (await res.json()) as PublicBookingResponse;

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Unable to load event details.');
    }

    return {
      title: data.data?.title || 'Discovery Call',
      length: data.data?.length || 30,
    };
  };

  const handleLoadSlots = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoadingSlots(true);
    setSelectedStart('');

    try {
      let effectiveUsername = username.trim();
      let effectiveEventTypeSlug = eventTypeSlug.trim();
      let effectiveTimeZone = timeZone.trim() || 'UTC';

      if (!effectiveUsername || !effectiveEventTypeSlug) {
        throw new Error('Please enter Username and Event slug.');
      }

      let context = await loadEventContext(effectiveUsername, effectiveEventTypeSlug);

      setEventTitle(context.title);
      setEventLength(context.length);

      const { slots: slotsForDate, matchedDateKey } = await loadSlotsForDate(effectiveUsername, effectiveEventTypeSlug, effectiveTimeZone);
      setAvailableSlots(slotsForDate);

      addMessage('user', `Find slots for ${selectedDate} (${effectiveTimeZone})`);
      if (slotsForDate.length) {
        addMessage('assistant', `Found ${slotsForDate.length} available times for ${context.title}.`);
        if (matchedDateKey !== selectedDate) {
          addMessage('system', `Showing times from ${matchedDateKey} to match timezone alignment.`);
        }
      } else {
        if (!sameDayOnly) {
          try {
            const nextAvailable = await loadNextAvailableSlots(effectiveUsername, effectiveEventTypeSlug, effectiveTimeZone);
            if (nextAvailable.slots.length) {
              setAvailableSlots(nextAvailable.slots);
              if (nextAvailable.dateKey !== selectedDate) {
                setSelectedDate(nextAvailable.dateKey);
              }
              addMessage(
                'assistant',
                `No free times on ${selectedDate}. Next available times are on ${nextAvailable.dateKey}.`
              );
              return;
            }
          } catch {
            // Fall through to existing guidance.
          }
        } else {
          addMessage('assistant', 'No free times found for that date in same-day-only mode. Change the date or disable same-day-only.');
        }

        const defaults = await getProfileDefaults();
        if (defaults?.availabilityKnown && defaults.source === 'authenticated' && defaults.hasAvailability) {
          try {
            const retry = await loadSlotsForDate(effectiveUsername, effectiveEventTypeSlug, effectiveTimeZone);
            if (retry.slots.length) {
              setAvailableSlots(retry.slots);
              addMessage('assistant', `Default working hours loaded. Found ${retry.slots.length} available times.`);
              if (retry.matchedDateKey !== selectedDate) {
                addMessage('system', `Showing times from ${retry.matchedDateKey} to match timezone alignment.`);
              }
              return;
            }
          } catch {
            // Keep the empty-state guidance below.
          }
        }

        if (defaults?.availabilityKnown && defaults.source === 'authenticated' && !defaults.hasAvailability) {
          addMessage('system', 'No availability schedule is configured yet. I could not auto-create one. Set Availability once, then reload times.');
        } else {
          if (!sameDayOnly) {
            addMessage('assistant', 'No free times found for that date. Try a different date.');
          }
        }
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to load slots.';

      const lowerMessage = String(message).toLowerCase();
      const shouldAttemptRecovery = lowerMessage.includes('user not found') || lowerMessage.includes('event type not found');

      if (shouldAttemptRecovery) {
        const defaults = await getProfileDefaults(username.trim());
        if (defaults && defaults.activeEventTypeCount === 0 && !defaults.eventTypeSlug) {
          setAvailableSlots([]);
          addMessage('system', 'No active event types found for this profile. Create or activate one in Event Types, then try again.');
          return;
        }

        const effectiveUsername =
          !userEditedUsernameRef.current && defaults?.username
            ? defaults.username
            : username.trim();
        const effectiveEventTypeSlug =
          !userEditedEventSlugRef.current && defaults?.eventTypeSlug
            ? defaults.eventTypeSlug
            : eventTypeSlug.trim();
        const effectiveTimeZone =
          !userEditedTimeZoneRef.current && defaults?.timeZone
            ? defaults.timeZone
            : timeZone.trim() || 'UTC';

        if (!userEditedUsernameRef.current && defaults?.username) {
          setUsername(defaults.username);
        }
        if (!userEditedEventSlugRef.current && defaults?.eventTypeSlug) {
          setEventTypeSlug(defaults.eventTypeSlug);
        }
        if (!userEditedTimeZoneRef.current && defaults?.timeZone) {
          setTimeZone(defaults.timeZone);
        }

        if (effectiveUsername && effectiveEventTypeSlug) {
          try {
            const context = await loadEventContext(effectiveUsername, effectiveEventTypeSlug);
            setEventTitle(context.title);
            setEventLength(context.length);

            const { slots: slotsForDate, matchedDateKey } = await loadSlotsForDate(
              effectiveUsername,
              effectiveEventTypeSlug,
              effectiveTimeZone
            );
            setAvailableSlots(slotsForDate);

            addMessage('assistant', `Profile defaults loaded. Found ${slotsForDate.length} available times.`);
            if (matchedDateKey !== selectedDate) {
              addMessage('system', `Showing times from ${matchedDateKey} to match timezone alignment.`);
            }
            return;
          } catch {
            // Fall through to user-facing guidance below.
          }
        }
      }

      setAvailableSlots([]);
      addMessage('system', `${message} Please confirm Username and Event slug fields.`);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBook = async () => {
    if (!canBook) return;
    setBooking(true);

    try {
      addMessage('user', `Book ${formatSlotForDisplay(selectedStart, timeZone)} for ${guestName}`);

      const res = await fetch('/api/v2/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          eventTypeSlug,
          start: selectedStart,
          attendee: {
            name: guestName.trim(),
            email: guestEmail.trim(),
            timeZone,
          },
          metadata: {
            notes: notes.trim(),
            source: 'planxo-text-assistant',
          },
        }),
      });

      const data = (await res.json()) as BookResponse;
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error?.message || 'Booking failed.');
      }

      addMessage('assistant', 'Booking confirmed. Your meeting has been created successfully.');

      setSelectedStart('');
      setGuestName('');
      setGuestEmail('');
      setNotes('');
    } catch (error: any) {
      addMessage('system', error?.message || 'Booking could not be completed.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: isCompact ? 14 : 18 }}>
      <form
        onSubmit={handleLoadSlots}
        style={{
          border: `1px solid ${palette.border}`,
          borderRadius: 14,
          padding: isCompact ? 14 : 18,
          background: palette.cardBg,
          color: palette.text,
          display: 'grid',
          gap: isCompact ? 12 : 14,
        }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Username
            <input
              value={username}
              onChange={(e) => {
                userEditedUsernameRef.current = true;
                setUsername(e.target.value);
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${palette.border}`,
                background: palette.bgSecondary,
                color: palette.text,
                width: '100%',
                minWidth: 0,
                fontSize: 16,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Event slug
            <input
              value={eventTypeSlug}
              onChange={(e) => {
                userEditedEventSlugRef.current = true;
                setEventTypeSlug(e.target.value);
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${palette.border}`,
                background: palette.bgSecondary,
                color: palette.text,
                width: '100%',
                minWidth: 0,
                fontSize: 16,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Date
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${palette.border}`,
                background: palette.bgSecondary,
                color: palette.text,
                width: '100%',
                minWidth: 0,
                fontSize: 16,
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Time zone
            <input
              value={timeZone}
              onChange={(e) => {
                userEditedTimeZoneRef.current = true;
                setTimeZone(e.target.value);
              }}
              style={{
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${palette.border}`,
                background: palette.bgSecondary,
                color: palette.text,
                width: '100%',
                minWidth: 0,
                fontSize: 16,
              }}
            />
          </label>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: palette.text,
            cursor: 'pointer',
            userSelect: 'none',
          }}>
          <input
            type="checkbox"
            checked={sameDayOnly}
            onChange={(e) => setSameDayOnly(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Same day only (disable auto look-ahead)
        </label>

        <button
          type="submit"
          disabled={loadingSlots}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '11px 14px',
            background: palette.accent,
            color: palette.accentText,
            fontWeight: 700,
            cursor: loadingSlots ? 'not-allowed' : 'pointer',
            opacity: loadingSlots ? 0.65 : 1,
            minHeight: 44,
            fontSize: 15,
            width: isCompact ? '100%' : 'auto',
          }}>
          {loadingSlots ? 'Loading slots...' : 'Load available times'}
        </button>
      </form>

      <div style={{ border: `1px solid ${palette.border}`, borderRadius: 14, background: palette.cardBg, color: palette.text, padding: isCompact ? 14 : 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 18, overflowWrap: 'anywhere' }}>{eventTitle}</h2>
          <span style={{ fontSize: 13, color: palette.textMuted }}>{eventLength} min</span>
        </div>

        {!availableSlots.length ? (
          <p style={{ margin: 0, color: palette.textMuted, fontSize: 14 }}>No times loaded yet. Use the form above to fetch availability.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            {availableSlots.map((slotIso) => {
              const isActive = selectedStart === slotIso;
              return (
                <button
                  key={slotIso}
                  type="button"
                  onClick={() => setSelectedStart(slotIso)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    textAlign: 'left',
                    border: `1px solid ${isActive ? palette.accent : palette.border}`,
                    background: isActive ? palette.bgSecondary : palette.bg,
                    color: palette.text,
                    cursor: 'pointer',
                    minHeight: 52,
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{formatSlotForDisplay(slotIso, timeZone)}</div>
                  <div style={{ fontSize: 12, color: palette.textMuted, overflowWrap: 'anywhere' }}>{timeZone}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ border: `1px solid ${palette.border}`, borderRadius: 14, background: palette.cardBg, color: palette.text, padding: isCompact ? 14 : 18, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>Confirm booking by text</h3>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isCompact ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <input
            placeholder="Guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bgSecondary, color: palette.text, width: '100%', minWidth: 0, fontSize: 16 }}
          />
          <input
            placeholder="Guest email"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bgSecondary, color: palette.text, width: '100%', minWidth: 0, fontSize: 16 }}
          />
        </div>
        <textarea
          placeholder="Booking notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ padding: 10, borderRadius: 8, border: `1px solid ${palette.border}`, background: palette.bgSecondary, color: palette.text, resize: 'vertical', width: '100%', minWidth: 0, fontSize: 16 }}
        />

        <button
          type="button"
          onClick={handleBook}
          disabled={!canBook || booking}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '11px 14px',
            background: '#d4944e',
            color: '#1a1008',
            fontWeight: 700,
            cursor: !canBook || booking ? 'not-allowed' : 'pointer',
            opacity: !canBook || booking ? 0.6 : 1,
            minHeight: 44,
            fontSize: 15,
            width: isCompact ? '100%' : 'auto',
          }}>
          {booking ? 'Booking...' : 'Book selected time'}
        </button>
      </div>

      <div style={{ border: `1px solid ${palette.border}`, borderRadius: 14, background: palette.cardBg, color: palette.text, padding: isCompact ? 14 : 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 17 }}>Text session log</h3>
        <div style={{ display: 'grid', gap: 8, maxHeight: isCompact ? 220 : 260, overflow: 'auto' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background:
                  message.role === 'assistant'
                    ? 'rgba(196,127,58,0.16)'
                    : message.role === 'user'
                    ? 'rgba(160,137,110,0.16)'
                    : 'rgba(212,148,78,0.22)',
                border: `1px solid ${palette.border}`,
                fontSize: 14,
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}>
              <strong style={{ textTransform: 'capitalize', marginRight: 6 }}>{message.role}:</strong>
              {message.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}