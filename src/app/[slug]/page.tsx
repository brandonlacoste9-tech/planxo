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
  user: { name: string; username: string };
}

interface SlotResponse {
  slots: string[];
  price: number;
  currency: string;
  dailyCapReached: boolean;
  dailyBookings: number;
  maxPerDay: number | null;
}

export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotInfo, setSlotInfo] = useState<SlotResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [booking, setBooking] = useState<{ status: string; guestName?: string; meetingUrl?: string } | null>(null);
  const [timeZone, setTimeZone] = useState("America/Toronto");

  // Fetch event type by slug
  useEffect(() => {
    // Auto-detect visitor timezone
    try {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {}

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

  // Fetch slots when date changes
  useEffect(() => {
    if (!eventType || !date) {
      setSlots([]);
      setSlotInfo(null);
      return;
    }
    setLoadingSlots(true);
    const startDate = new Date(date + "T00:00:00");
    const endDate = new Date(startDate.getTime() + 86400000);
    fetch(`/api/v2/slots?eventTypeSlug=${eventType.slug}&startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}&timeZone=${timeZone}`)
      .then((r) => r.json())
      .then((data) => {
        // New format: { status: "success", data: { "2026-05-27": ["ISO..."] } }
        const daySlots = data.data?.[date] || [];
        // Convert ISO timestamps to HH:MM
        const times = daySlots.map((iso: string) => {
          const d = new Date(iso);
          return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        });
        setSlots(times);
        setSlotInfo(data);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, eventType]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !form.name || !form.email) return;

    // Build ISO start time from date + selected slot
    const startISO = new Date(`${date}T${selectedSlot}:00`).toISOString();

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

    if (res.status === 409) {
      setError("Ce créneau n'est plus disponible. Choisissez une autre heure.");
      setSelectedSlot("");
      return;
    }

    if (res.ok) {
      const b = await res.json();
      setBooking({ status: "confirmed", guestName: b.guestName });
    } else {
      setError("Erreur lors de la réservation.");
    }
  }

  // Show confirmation
  if (booking?.status === "confirmed") {
    return (
      <div style={styles.container}>
        <div style={styles.confirmCard}>
          <div style={styles.checkmark}>✓</div>
          <h2 style={styles.confirmTitle}>Rendez-vous confirmé!</h2>
          <p style={styles.confirmText}>
            {eventType?.title}<br />
            {new Date(date + "T" + selectedSlot).toLocaleDateString("fr-CA", {
              weekday: "long", day: "numeric", month: "long",
            })}
            {" à "}
            {selectedSlot}
          </p>
          {booking.meetingUrl && (
            <a href={booking.meetingUrl} target="_blank" style={styles.meetingLink}>
              📹 Rejoindre la réunion →
            </a>
          )}
          <p style={styles.confirmSubtext}>
            Un courriel de confirmation sera envoyé à {form.email}.
          </p>
          <a href={`/${slug}`} style={styles.backBtn}>Réserver un autre</a>
        </div>
      </div>
    );
  }

  if (loading) return <div style={styles.container}><p style={styles.muted}>Chargement...</p></div>;
  if (error && !eventType) return <div style={styles.container}><p style={styles.error}>{error}</p></div>;
  if (!eventType) return null;

  // Generate next 14 days for date picker
  const days: { label: string; value: string; dayName: string }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      label: d.toLocaleDateString("fr-CA", { day: "numeric", month: "short" }),
      value: d.toISOString().split("T")[0],
      dayName: d.toLocaleDateString("fr-CA", { weekday: "short" }),
    });
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Host info */}
        <div style={styles.hostRow}>
          <div style={styles.hostAvatar}>{eventType.user.name[0]}</div>
          <div>
            <div style={styles.hostName}>{eventType.user.name}</div>
            <div style={styles.muted}>{eventType.title}</div>
          </div>
        </div>

        <div style={styles.meta}>
          <span style={styles.metaBadge}>🕐 {eventType.length} min</span>
          <span style={styles.metaBadge}>
            {eventType.location === "google-meet" ? "📹 Google Meet" :
             eventType.location === "phone" ? "📞 Téléphone" :
             eventType.location === "zoom" ? "📹 Zoom" :
             eventType.location === "teams" ? "📹 Teams" : "📍 En personne"}
          </span>
          <span style={styles.metaBadge}>🌍 {timeZone}</span>
          {eventType.price > 0 && (
            <span style={{...styles.metaBadge, background: "#fef3c7", color: "#92400e", fontWeight: 700}}>
              {(eventType.price / 100).toFixed(2)} {eventType.currency.toUpperCase()}
            </span>
          )}
        </div>

        {eventType.description && (
          <p style={styles.description}>{eventType.description}</p>
        )}

        {/* Date selector */}
        <div style={styles.section}>
          <label style={styles.label}>Choisissez une date</label>
          <div style={styles.dateGrid}>
            {days.map((d) => (
              <button
                key={d.value}
                style={date === d.value ? styles.dateBtnActive : styles.dateBtn}
                onClick={() => { setDate(d.value); setSelectedSlot(""); }}
              >
                <div style={styles.dateDayName}>{d.dayName}</div>
                <div style={styles.dateDayNum}>{d.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time slots */}
        {date && (
          <div style={styles.section}>
            <label style={styles.label}>
              Choisissez une heure
              {loadingSlots && <span style={styles.muted}> — Chargement...</span>}
            </label>
            {!loadingSlots && slots.length === 0 && !slotInfo?.dailyCapReached && (
              <p style={styles.muted}>Aucun créneau disponible pour cette date.</p>
            )}
            {slotInfo?.dailyCapReached && (
              <p style={{...styles.muted, color: "#dc2626", fontWeight: 500}}>
                Limite quotidienne atteinte ({slotInfo.dailyBookings}/{slotInfo.maxPerDay} rendez-vous).
              </p>
            )}
            <div style={styles.slotGrid}>
              {slots.map((slot) => (
                <button
                  key={slot}
                  style={selectedSlot === slot ? styles.slotBtnActive : styles.slotBtn}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Booking form */}
        {selectedSlot && (
          <form onSubmit={handleBook} style={styles.section}>
            <label style={styles.label}>Vos informations</label>
            <input
              style={styles.input}
              placeholder="Votre nom"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              style={styles.input}
              type="email"
              placeholder="Votre courriel"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <textarea
              style={{ ...styles.input, minHeight: 80, resize: "vertical" }}
              placeholder="Notes additionnelles (optionnel)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={styles.submitBtn}>
              Confirmer le rendez-vous
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  meta: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  metaBadge: {
    fontSize: 13, fontWeight: 500, color: "#6b7280",
    background: "#f9fafb", padding: "4px 10px", borderRadius: 6,
  },
  description: { fontSize: 14, color: "#6b7280", lineHeight: 1.6, marginBottom: 24 },
  section: { marginTop: 24 },
  label: { fontSize: 14, fontWeight: 600, color: "#242424", marginBottom: 8, display: "block" },
  dateGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 },
  dateBtn: {
    padding: "10px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff", cursor: "pointer", textAlign: "center" as const,
    fontFamily: "'Inter', sans-serif",
  },
  dateBtnActive: {
    padding: "10px 8px", borderRadius: 8, border: "2px solid #242424",
    background: "#242424", color: "#fff", cursor: "pointer", textAlign: "center" as const,
    fontFamily: "'Inter', sans-serif",
  },
  dateDayName: { fontSize: 12, fontWeight: 500, textTransform: "uppercase", opacity: 0.7 },
  dateDayNum: { fontSize: 16, fontWeight: 700, marginTop: 2 },
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
  },
  error: { color: "#dc2626", fontSize: 13, marginTop: 8 },
  confirmCard: { textAlign: "center" as const, padding: 48, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16 },
  checkmark: {
    width: 64, height: 64, borderRadius: "50%", background: "#ecfdf5",
    color: "#059669", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 28, fontWeight: 700, margin: "0 auto 20px",
  },
  confirmTitle: { fontFamily: "'Cal Sans', sans-serif", fontSize: 24, fontWeight: 700, margin: "0 0 8px" },
  confirmText: { fontSize: 16, color: "#242424", lineHeight: 1.6, marginBottom: 8 },
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
