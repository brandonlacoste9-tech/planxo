"use client";

import { useState, useEffect, use } from "react";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  length: number;
  location: string;
  price: number;
  currency: string;
  user: { name: string; username: string; timeZone: string };
}

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ time: string; iso: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [booking, setBooking] = useState<{
    status: string; guestName?: string; meetingUrl?: string;
    start?: string; end?: string; eventTypeTitle?: string;
  } | null>(null);
  const [timeZone, setTimeZone] = useState("America/Toronto");

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());

  // Auto-detect visitor timezone
  useEffect(() => {
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {}
  }, []);

  // Fetch event type by slug
  useEffect(() => {
    fetch("/api/v2/me")
      .then((r) => r.json())
      .then((user) => {
        const et = user.eventTypes?.find((e: EventType) => e.slug === slug);
        if (et) {
          setEventType({ ...et, user });
        } else {
          setError("Ce type de rendez-vous n'existe pas.");
        }
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [slug]);

  // Fetch availability for the visible month
  useEffect(() => {
    if (!eventType) return;
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Range: first day of month to first day of next month
    const rangeStart = new Date(year, month, 1);
    const rangeEnd = new Date(year, month + 1, 1);
    // Extend to show last few days of previous month and first few of next
    // by padding the range to capture partial weeks
    const padStart = new Date(rangeStart);
    padStart.setDate(padStart.getDate() - 7);
    const padEnd = new Date(rangeEnd);
    padEnd.setDate(padEnd.getDate() + 7);

    const startISO = padStart.toISOString();
    const endISO = padEnd.toISOString();

    fetch(
      `/api/v2/slots?eventTypeSlug=${eventType.slug}&startTime=${startISO}&endTime=${endISO}&timeZone=${timeZone}`
    )
      .then((r) => r.json())
      .then((data) => {
        // Extract just the day keys that have slots
        const days = new Set<string>(Object.keys(data.data || {}));
        setAvailableDays(days);
      })
      .catch(() => {});
  }, [currentMonth, eventType, timeZone]);

  // Fetch slots when a specific date is selected
  useEffect(() => {
    if (!eventType || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    const startDate = new Date(date + "T00:00:00");
    const endDate = new Date(startDate.getTime() + 86400000);
    fetch(
      `/api/v2/slots?eventTypeSlug=${eventType.slug}&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}&timeZone=${timeZone}`
    )
      .then((r) => r.json())
      .then((data) => {
        const daySlots: string[] = data.data?.[date] || [];
        // Convert ISO timestamps to local time display
        const times = daySlots.map((iso: string) => {
          const d = new Date(iso);
          const local = d.toLocaleTimeString("fr-CA", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone,
            hour12: false,
          });
          return { time: local, iso };
        });
        setSlots(times);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, eventType, timeZone]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !form.name || !form.email) return;
    setError("");
    setSubmitting(true);

    // Find the selected slot's ISO timestamp
    const slotData = slots.find((s) => s.time === selectedSlot);
    const startISO = slotData?.iso || new Date(`${date}T${selectedSlot}:00`).toISOString();

    const res = await fetch("/api/v2/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: startISO,
        eventTypeId: eventType!.id,
        attendee: { name: form.name, email: form.email, timeZone },
        metadata: { notes: form.notes },
      }),
    });

    setSubmitting(false);

    if (res.status === 409) {
      setError("Ce créneau n'est plus disponible. Choisissez une autre heure.");
      setSelectedSlot("");
      return;
    }

    if (res.ok) {
      const json = await res.json();
      const b = json.data;
      setBooking({
        status: "confirmed",
        guestName: b.attendees?.[0]?.name || form.name,
        meetingUrl: b.meetingUrl,
        start: b.start,
        end: b.end,
        eventTypeTitle: eventType?.title,
      });
    } else {
      setError("Erreur lors de la réservation.");
    }
  }

  // ── Calendar builder ──
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  // Convert to Monday-first (0=Mon, 6=Sun)
  const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;

  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  function prevMonth() {
    setCurrentMonth(new Date(year, month - 1, 1));
    setDate("");
    setSelectedSlot("");
    setSlots([]);
  }

  function nextMonth() {
    setCurrentMonth(new Date(year, month + 1, 1));
    setDate("");
    setSelectedSlot("");
    setSlots([]);
  }

  function isPast(day: number): boolean {
    const d = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return d < today;
  }

  function dayKey(day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // ── Confirmation view ──
  if (booking?.status === "confirmed") {
    const startDate = booking.start ? new Date(booking.start) : null;
    const endDate = booking.end ? new Date(booking.end) : null;
    return (
      <div style={s.container}>
        <div style={s.confirmCard}>
          <div style={s.checkmark}>✓</div>
          <h2 style={s.confirmTitle}>Rendez-vous confirmé!</h2>
          <p style={s.confirmText}>
            {booking.eventTypeTitle || eventType?.title}
            <br />
            {startDate?.toLocaleDateString("fr-CA", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {" · "}
            {startDate?.toLocaleTimeString("fr-CA", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone,
            })}
            {" → "}
            {endDate?.toLocaleTimeString("fr-CA", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone,
            })}
          </p>
          {booking.meetingUrl && (
            <a href={booking.meetingUrl} target="_blank" rel="noopener" style={s.meetingLink}>
              📹 Rejoindre la réunion →
            </a>
          )}
          <p style={s.confirmSubtext}>
            Une confirmation sera envoyée à {form.email}.
          </p>
          <a href={`/${slug}`} style={s.backBtn}>
            Réserver un autre
          </a>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (loading)
    return (
      <div style={s.container}>
        <p style={s.muted}>Chargement...</p>
      </div>
    );
  if (error && !eventType)
    return (
      <div style={s.container}>
        <p style={s.error}>{error}</p>
      </div>
    );
  if (!eventType) return null;

  // ── Main booking view ──
  return (
    <div style={s.container}>
      <div style={s.card}>
        {/* Host info */}
        <div style={s.hostRow}>
          <div style={s.hostAvatar}>{eventType.user.name[0]}</div>
          <div>
            <div style={s.hostName}>{eventType.user.name}</div>
            <div style={s.muted}>{eventType.title}</div>
          </div>
        </div>

        <div style={s.meta}>
          <span style={s.metaBadge}>🕐 {eventType.length} min</span>
          <span style={s.metaBadge}>
            {eventType.location === "google-meet"
              ? "📹 Google Meet"
              : eventType.location === "phone"
                ? "📞 Téléphone"
                : eventType.location === "zoom"
                  ? "📹 Zoom"
                  : eventType.location === "teams"
                    ? "📹 Teams"
                    : "📍 En personne"}
          </span>
          <span style={s.metaBadge}>🌍 {timeZone}</span>
          {eventType.price > 0 && (
            <span style={{ ...s.metaBadge, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}>
              {(eventType.price / 100).toFixed(2)} {eventType.currency.toUpperCase()}
            </span>
          )}
        </div>

        {eventType.description && (
          <p style={s.description}>{eventType.description}</p>
        )}

        {/* ── CALENDAR ── */}
        <div style={s.section}>
          <label style={s.label}>Choisissez une date</label>
          <div style={s.calHeader}>
            <button onClick={prevMonth} style={s.navBtn} aria-label="Mois précédent">
              ‹
            </button>
            <span style={s.monthTitle}>
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} style={s.navBtn} aria-label="Mois suivant">
              ›
            </button>
          </div>

          {/* Day headers */}
          <div style={s.calGrid}>
            {days.map((d) => (
              <div key={d} style={s.calDayHeader}>
                {d}
              </div>
            ))}

            {/* Empty cells before first day */}
            {Array.from({ length: firstDayMon }, (_, i) => (
              <div key={`empty-${i}`} style={s.calCell} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dk = dayKey(day);
              const past = isPast(day);
              const available = availableDays.has(dk);
              const selected = dk === date;
              const isToday = dk === today;

              return (
                <button
                  key={day}
                  style={{
                    ...s.calCell,
                    ...(selected ? s.calCellSelected : {}),
                    ...(past ? s.calCellPast : {}),
                    ...(isToday && !selected ? s.calCellToday : {}),
                  }}
                  disabled={past}
                  onClick={() => {
                    setDate(dk);
                    setSelectedSlot("");
                    setError("");
                  }}
                >
                  <span style={s.calDayNum}>{day}</span>
                  {available && !past && (
                    <span
                      style={{
                        ...s.calDot,
                        ...(selected ? s.calDotSelected : {}),
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time slots */}
        {date && (
          <div style={s.section}>
            <label style={s.label}>
              Choisissez une heure
              {loadingSlots && (
                <span style={{ ...s.muted, marginLeft: 8 }}>
                  Chargement...
                </span>
              )}
            </label>
            {!loadingSlots && slots.length === 0 && (
              <p style={s.muted}>Aucun créneau disponible pour cette date.</p>
            )}
            <div style={s.slotGrid}>
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  style={selectedSlot === slot.time ? s.slotBtnActive : s.slotBtn}
                  onClick={() => setSelectedSlot(slot.time)}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Booking form */}
        {selectedSlot && (
          <form onSubmit={handleBook} style={s.section}>
            <label style={s.label}>Vos informations</label>
            <input
              style={s.input}
              placeholder="Votre nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              style={s.input}
              type="email"
              placeholder="Votre courriel"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <textarea
              style={{ ...s.input, minHeight: 80, resize: "vertical" }}
              placeholder="Notes additionnelles (optionnel)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            {error && <p style={s.error}>{error}</p>}
            <button type="submit" style={s.submitBtn} disabled={submitting}>
              {submitting ? "Réservation en cours..." : "Confirmer le rendez-vous"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Styles ──
const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "40px 24px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: "#242424",
    background: "#fff",
    minHeight: "100vh",
  },
  card: {
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 16,
    padding: 32,
    background: "#fff",
    boxShadow: "rgba(0,0,0,0.04) 0px 4px 16px",
  },
  hostRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16 },
  hostAvatar: {
    width: 44, height: 44, borderRadius: "50%",
    background: "#242424", color: "#fff", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 700, flexShrink: 0,
  },
  hostName: { fontSize: 16, fontWeight: 700, color: "#242424" },
  muted: { fontSize: 13, color: "#898989", marginTop: 2 },
  meta: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" as const },
  metaBadge: {
    fontSize: 13, fontWeight: 500, color: "#6b7280",
    background: "#f9fafb", padding: "4px 10px", borderRadius: 6,
    whiteSpace: "nowrap" as const,
  },
  description: { fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 },
  section: { marginTop: 24 },
  label: { fontSize: 14, fontWeight: 600, color: "#242424", marginBottom: 10, display: "block" },

  // Calendar
  calHeader: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.1)", background: "#fff",
    fontSize: 20, fontWeight: 600, color: "#242424",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', sans-serif",
  },
  monthTitle: {
    fontSize: 15, fontWeight: 700, color: "#242424",
    fontFamily: "'Cal Sans', 'Inter', sans-serif",
  },
  calGrid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
  },
  calDayHeader: {
    fontSize: 12, fontWeight: 600, color: "#898989",
    textAlign: "center" as const, padding: "6px 0",
    textTransform: "uppercase" as const,
  },
  calCell: {
    aspectRatio: "1",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "transparent",
    cursor: "pointer",
    display: "flex", flexDirection: "column" as const,
    alignItems: "center", justifyContent: "center",
    gap: 2,
    fontFamily: "'Inter', sans-serif",
    transition: "all 0.12s",
    position: "relative" as const,
    padding: 0,
  },
  calCellToday: {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "#f9fafb",
  },
  calCellSelected: {
    background: "#242424",
    color: "#fff",
    border: "1px solid #242424",
  },
  calCellPast: {
    opacity: 0.25,
    cursor: "default",
  },
  calDayNum: {
    fontSize: 14,
    fontWeight: 500,
  },
  calDot: {
    width: 5, height: 5, borderRadius: "50%",
    background: "#059669",
  },
  calDotSelected: {
    background: "#34d399",
  },

  // Slots
  slotGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 },
  slotBtn: {
    padding: "10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500,
    fontFamily: "'Inter', sans-serif", color: "#242424",
  },
  slotBtnActive: {
    padding: "10px", borderRadius: 8, border: "2px solid #242424",
    background: "#242424", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
  },

  // Form
  input: {
    width: "100%", boxSizing: "border-box" as const,
    padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
    fontSize: 14, fontFamily: "'Inter', sans-serif", marginBottom: 10,
    outline: "none",
  },
  submitBtn: {
    width: "100%", padding: "14px", borderRadius: 8, border: "none",
    background: "#242424", color: "#fff", fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Inter', sans-serif", marginTop: 8,
    transition: "opacity 0.15s",
  },
  error: { color: "#dc2626", fontSize: 13, marginTop: 8 },

  // Confirmation
  confirmCard: { textAlign: "center" as const, padding: 48, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 },
  checkmark: {
    width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5",
    color: "#059669", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 28, fontWeight: 700, margin: "0 auto 20px",
  },
  confirmTitle: { fontFamily: "'Cal Sans', sans-serif", fontSize: 24, fontWeight: 700, margin: "0 0 12px" },
  confirmText: { fontSize: 16, color: "#242424", lineHeight: 1.7, marginBottom: 16 },
  confirmSubtext: { fontSize: 13, color: "#898989", marginBottom: 24 },
  meetingLink: {
    display: "inline-block", marginBottom: 16, padding: "10px 20px",
    background: "#ecfdf5", color: "#059669", borderRadius: 8,
    textDecoration: "none", fontSize: 14, fontWeight: 600,
  },
  backBtn: {
    display: "inline-block", padding: "12px 24px", borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.12)", color: "#242424", textDecoration: "none",
    fontSize: 14, fontWeight: 600,
  },
};
