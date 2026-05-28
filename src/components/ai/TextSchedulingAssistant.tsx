'use client';

import { FormEvent, useMemo, useState } from 'react';

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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  defaultEventTypeSlug = 'appel-de-decouverte',
}: {
  defaultUsername?: string;
  defaultEventTypeSlug?: string;
}) {
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
  const [eventTitle, setEventTitle] = useState('Discovery Call');
  const [eventLength, setEventLength] = useState<number>(30);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
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

  const loadEventContext = async () => {
    const url = `/api/v2/public-booking?username=${encodeURIComponent(username)}&eventSlug=${encodeURIComponent(eventTypeSlug)}`;
    const res = await fetch(url);
    const data = (await res.json()) as PublicBookingResponse;

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Unable to load event details.');
    }

    setEventTitle(data.data?.title || 'Discovery Call');
    setEventLength(data.data?.length || 30);
  };

  const handleLoadSlots = async (e?: FormEvent) => {
    e?.preventDefault();
    setLoadingSlots(true);
    setSelectedStart('');

    try {
      await loadEventContext();

      const startTime = `${selectedDate}T00:00:00.000Z`;
      const endDate = new Date(`${selectedDate}T00:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endTime = endDate.toISOString();

      const slotsUrl = `/api/v2/slots?username=${encodeURIComponent(username)}&eventTypeSlug=${encodeURIComponent(eventTypeSlug)}&startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&timeZone=${encodeURIComponent(timeZone)}`;
      const res = await fetch(slotsUrl);
      const data = (await res.json()) as SlotsResponse;

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.error?.message || 'Could not load availability.');
      }

      const slotsForDate = data.data?.[selectedDate] || [];
      setAvailableSlots(slotsForDate);

      addMessage('user', `Find slots for ${selectedDate} (${timeZone})`);
      if (slotsForDate.length) {
        addMessage('assistant', `Found ${slotsForDate.length} available times for ${eventTitle}.`);
      } else {
        addMessage('assistant', 'No free times found for that date. Try a different date.');
      }
    } catch (error: any) {
      setAvailableSlots([]);
      addMessage('system', error?.message || 'Failed to load slots.');
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
      <form
        onSubmit={handleLoadSlots}
        style={{
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 14,
          padding: 18,
          background: 'white',
          display: 'grid',
          gap: 14,
        }}>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Event slug
            <input value={eventTypeSlug} onChange={(e) => setEventTypeSlug(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Date
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
            Time zone
            <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }} />
          </label>
        </div>

        <button
          type="submit"
          disabled={loadingSlots}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '11px 14px',
            background: '#111827',
            color: 'white',
            fontWeight: 700,
            cursor: loadingSlots ? 'not-allowed' : 'pointer',
            opacity: loadingSlots ? 0.65 : 1,
          }}>
          {loadingSlots ? 'Loading slots...' : 'Load available times'}
        </button>
      </form>

      <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, background: 'white', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{eventTitle}</h2>
          <span style={{ fontSize: 13, color: '#4b5563' }}>{eventLength} min</span>
        </div>

        {!availableSlots.length ? (
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>No times loaded yet. Use the form above to fetch availability.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
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
                    border: `1px solid ${isActive ? '#111827' : 'rgba(0,0,0,0.15)'}`,
                    background: isActive ? '#f3f4f6' : 'white',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{formatSlotForDisplay(slotIso, timeZone)}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{timeZone}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, background: 'white', padding: 18, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>Confirm booking by text</h3>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <input
            placeholder="Guest name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }}
          />
          <input
            placeholder="Guest email"
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }}
          />
        </div>
        <textarea
          placeholder="Booking notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)', resize: 'vertical' }}
        />

        <button
          type="button"
          onClick={handleBook}
          disabled={!canBook || booking}
          style={{
            border: 'none',
            borderRadius: 10,
            padding: '11px 14px',
            background: '#0f766e',
            color: 'white',
            fontWeight: 700,
            cursor: !canBook || booking ? 'not-allowed' : 'pointer',
            opacity: !canBook || booking ? 0.6 : 1,
          }}>
          {booking ? 'Booking...' : 'Book selected time'}
        </button>
      </div>

      <div style={{ border: '1px solid rgba(0,0,0,0.12)', borderRadius: 14, background: 'white', padding: 18 }}>
        <h3 style={{ marginTop: 0, fontSize: 17 }}>Text session log</h3>
        <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflow: 'auto' }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: message.role === 'assistant' ? '#eff6ff' : message.role === 'user' ? '#f3f4f6' : '#fef3c7',
                border: '1px solid rgba(0,0,0,0.08)',
                fontSize: 14,
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