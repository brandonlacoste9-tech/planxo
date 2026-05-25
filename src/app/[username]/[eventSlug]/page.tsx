"use client";

import { useState, useEffect, use } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, AlertCircle, CheckCircle } from "lucide-react";

interface EventType {
  id: string; title: string; slug: string; description: string;
  length: number; location: string; price: number; currency: string;
  user: { name: string; username: string; timeZone: string };
}

// Brand colors
const colors = {
  bg: "#1a1008",
  bg2: "#241810",
  text: "#e8d5c4",
  textMuted: "#c4a882",
  accent: "#c47f3a",
  accentHover: "#d4944e",
  accentText: "#1a1008",
  border: "rgba(196,127,58,0.12)",
  cardBg: "#241810",
  success: "#c47f3a",
  gold: "#d4a853",
  dimText: "#6b5040",
};

export default function BookingPage({ params }: { params: Promise<{ username: string; eventSlug: string }> }) {
  const { username, eventSlug } = use(params);
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ time: string; iso: string }[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [booking, setBooking] = useState<{ status: string; uid?: string; guestName?: string; meetingUrl?: string; start?: string; end?: string; eventTypeTitle?: string } | null>(null);
  const [timeZone, setTimeZone] = useState("America/Toronto");
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { try { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {} }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("booking") === "success") { setBooking({ status: "paid", guestName: form.name || "", eventTypeTitle: eventType?.title || "" }); window.history.replaceState({}, "", `/${username}/${eventSlug}`); return; }
    if (q.get("booking") === "cancelled") { setError("Payment cancelled."); window.history.replaceState({}, "", `/${username}/${eventSlug}`); return; }
  }, [username, eventSlug, eventType]);

  useEffect(() => {
    fetch(`/api/v2/me?username=${username}`)
      .then(r => r.json())
      .then(user => {
        if (user.error) { setError("User not found."); setLoading(false); return; }
        return fetch(`/api/v2/event-types?userId=${user.id}`);
      })
      .then(r => r?.json())
      .then(data => {
        const et = data?.data?.find((e: any) => e.slug === eventSlug);
        if (et) setEventType({ ...et, user: { name: et.user?.name || username, username, timeZone: et.user?.timeZone || "America/Toronto" } });
        else setError("Event type not found.");
      })
      .catch(() => setError("Error loading event."))
      .finally(() => setLoading(false));
  }, [username, eventSlug]);

  useEffect(() => {
    if (!eventType) return;
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const padStart = new Date(y, m, -6), padEnd = new Date(y, m + 1, 7);
    fetch(`/api/v2/slots?eventTypeId=${eventType.id}&startTime=${padStart.toISOString()}&endTime=${padEnd.toISOString()}&timeZone=${timeZone}`)
      .then(r => r.json()).then(d => setAvailableDays(new Set(Object.keys(d.data || {})))).catch(() => {});
  }, [currentMonth, eventType, timeZone]);

  useEffect(() => {
    if (!eventType || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    const sd = new Date(date + "T00:00:00"), ed = new Date(sd.getTime() + 86400000);
    fetch(`/api/v2/slots?eventTypeId=${eventType.id}&startTime=${sd.toISOString()}&endTime=${ed.toISOString()}&timeZone=${timeZone}`)
      .then(r => r.json()).then(d => {
        const daySlots: string[] = d.data?.[date] || [];
        setSlots(daySlots.map((iso: string) => {
          const d = new Date(iso);
          const parts = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", timeZone, hour12: false }).formatToParts(d);
          return { time: `${parts.find(p => p.type === "hour")?.value || "00"}:${parts.find(p => p.type === "minute")?.value || "00"}`, iso };
        }));
      }).catch(() => setSlots([])).finally(() => setLoadingSlots(false));
  }, [date, eventType, timeZone]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !form.name || !form.email) return;
    setError(""); setSubmitting(true);
    const slotData = slots.find(s => s.time === selectedSlot);
    const startISO = slotData?.iso || new Date(`${date}T${selectedSlot}:00`).toISOString();

    if (eventType!.price > 0) {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventTypeId: eventType!.id, start: startISO, attendee: { name: form.name, email: form.email, timeZone }, metadata: { notes: form.notes } }),
      });
      setSubmitting(false);
      if (res.ok) { const json = await res.json(); window.location.href = json.data.checkoutUrl; }
      else { const err = await res.json(); setError(err.error || "Payment error."); }
      return;
    }

    const res = await fetch("/api/v2/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startISO, eventTypeId: eventType!.id, attendee: { name: form.name, email: form.email, timeZone }, metadata: { notes: form.notes } }),
    });
    setSubmitting(false);
    if (res.status === 409) { setError("This slot is no longer available."); setSelectedSlot(""); return; }
    if (res.ok) {
      const json = await res.json(); const b = json.data;
      setBooking({ status: "confirmed", uid: b.uid, guestName: b.attendees?.[0]?.name || form.name, meetingUrl: b.meetingUrl, start: b.start, end: b.end, eventTypeTitle: eventType?.title });
    } else setError("Booking error.");
  }

  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay(), firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dk = (d: number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const nav = (dir: number) => { setCurrentMonth(new Date(y, m + dir, 1)); setDate(""); setSelectedSlot(""); setSlots([]); };
  const locIcon = eventType?.location === "google-meet" ? "📹" : eventType?.location === "phone" ? "📞" : eventType?.location === "zoom" ? "📹" : eventType?.location === "teams" ? "📹" : "📍";
  const locLabel = eventType?.location === "google-meet" ? "Google Meet" : eventType?.location === "phone" ? "Phone" : eventType?.location === "zoom" ? "Zoom" : eventType?.location === "teams" ? "Teams" : "In Person";
  const ALL_TIMEZONES: string[] = typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf('timeZone')
    : ['America/Toronto','America/New_York','America/Vancouver','Europe/Paris'];

  if (booking?.status === "confirmed" || booking?.status === "paid") {
    const sd = booking.start ? new Date(booking.start) : null;
    return (
      <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, padding: "32px", textAlign: "center", maxWidth: "480px", width: "100%" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: booking.status === "paid" ? "rgba(212,168,83,0.15)" : "rgba(196,127,58,0.15)", color: booking.status === "paid" ? colors.gold : colors.accent, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: "700", marginBottom: "20px" }}>
            {booking.status === "paid" ? "💳" : "✓"}
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: "700", color: colors.text, marginBottom: "8px", fontFamily: "'Cal Sans', 'Inter', sans-serif" }}>
            {booking.status === "paid" ? "Payment Successful!" : "Booking Confirmed!"}
          </h2>
          <p style={{ color: colors.textMuted, fontSize: "15px", marginBottom: "16px" }}>
            <span style={{ fontWeight: "600" }}>{booking.eventTypeTitle || eventType?.title}</span><br/>
            <span style={{ fontSize: "14px" }}>{sd?.toLocaleDateString("en-US", { weekday:"long",day:"numeric",month:"long" })}</span>
          </p>
          {booking.meetingUrl && (
            <a href={booking.meetingUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginBottom: "16px", padding: "10px 20px", background: "rgba(196,127,58,0.15)", color: colors.accent, borderRadius: "8px", textDecoration: "none", fontSize: "14px", fontWeight: "600", transition: "all 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.25)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.15)")}
            >
              📹 Join Meeting →
            </a>
          )}
          <p style={{ fontSize: "13px", color: colors.dimText, marginBottom: "24px" }}>Confirmation sent to {form.email}.</p>
          {booking.uid && (
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "24px", flexWrap: "wrap" }}>
              <a href={`/booking/${booking.uid}/reschedule`} style={{ fontSize: "13px", color: colors.accent, fontWeight: "600", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.accent)}
              >🔄 Reschedule</a>
              <a href={`/booking/${booking.uid}/cancel`} style={{ fontSize: "13px", color: colors.dimText, fontWeight: "600", textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = colors.textMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.color = colors.dimText)}
              >✕ Cancel</a>
            </div>
          )}
          <a href={`/${username}/${eventSlug}`} style={{ display: "inline-block", padding: "12px 24px", borderRadius: "8px", border: `1px solid ${colors.border}`, color: colors.text, textDecoration: "none", fontSize: "14px", fontWeight: "600", transition: "all 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.08)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            Book Another
          </a>
        </div>
      </div>
    );
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: `3px solid ${colors.border}`, borderTopColor: colors.accent, margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
        <p style={{ color: colors.textMuted }}>Loading availability...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error || !eventType) return (
    <div style={{ minHeight: "100vh", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, padding: "32px", textAlign: "center", maxWidth: "480px", width: "100%" }}>
        <AlertCircle style={{ width: "48px", height: "48px", color: colors.accent, margin: "0 auto 16px" }} />
        <p style={{ color: colors.text, fontWeight: "600" }}>{error || "Event not found"}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, padding: "32px 16px", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: "32px" }}>
          {/* Left Panel - Event Details */}
          <div>
            <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, padding: "24px", position: isMobile ? "relative" : "sticky", top: isMobile ? "auto" : "32px" }}>
              {/* Host Avatar */}
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: `linear-gradient(135deg, ${colors.gold}, ${colors.accent})`, color: colors.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: "700", marginBottom: "16px", fontFamily: "'Cal Sans', 'Inter', sans-serif" }}>
                {eventType.user.name[0]}
              </div>
              
              {/* Host Info */}
              <p style={{ fontSize: "14px", color: colors.textMuted, marginBottom: "4px", margin: "0 0 4px" }}>{eventType.user.name}</p>
              <h1 style={{ fontSize: "22px", fontWeight: "700", color: colors.text, marginBottom: "8px", margin: "0 0 8px", fontFamily: "'Cal Sans', 'Inter', sans-serif" }}>{eventType.title}</h1>
              <p style={{ fontSize: "13px", color: colors.dimText, marginBottom: "16px", margin: "0 0 16px" }}>with {eventType.user.name}</p>

              {/* Duration Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
                {[15, 30, 45, 60].map(d => (
                  <span key={d} style={{ padding: "6px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: d === eventType.length ? "600" : "400", background: d === eventType.length ? "rgba(196,127,58,0.15)" : "rgba(196,127,58,0.08)", color: d === eventType.length ? colors.accent : colors.dimText, border: d === eventType.length ? `1px solid ${colors.accent}` : `1px solid ${colors.border}` }}>
                    {d === 60 ? '1h' : `${d}m`}
                  </span>
                ))}
              </div>

              {/* Event Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px", paddingBottom: "24px", borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: colors.text }}>
                  <Clock style={{ width: "16px", height: "16px", color: colors.dimText }} />
                  <span>{eventType.length} minutes</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: colors.text }}>
                  <MapPin style={{ width: "16px", height: "16px", color: colors.dimText }} />
                  <span>{locLabel}</span>
                </div>
                {eventType.price > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "600", color: colors.accent, background: "rgba(196,127,58,0.15)", padding: "8px 12px", borderRadius: "8px" }}>
                    💳 {(eventType.price/100).toFixed(2)} {eventType.currency.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Timezone Selector */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "12px", fontWeight: "600", color: colors.textMuted, display: "block", marginBottom: "8px" }}>Timezone</label>
                <select value={timeZone} onChange={e => setTimeZone(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "13px", fontFamily: "'Inter', sans-serif", outline: "none", cursor: "pointer" }}>
                  {ALL_TIMEZONES.map(tz => (
                    <option key={tz} value={tz} style={{ background: colors.bg, color: colors.text }}>{tz}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              {eventType.description && (
                <p style={{ fontSize: "13px", color: colors.textMuted, lineHeight: "1.6", margin: 0 }}>{eventType.description}</p>
              )}
            </div>
          </div>

          {/* Right Panel - Calendar & Booking */}
          <div>
            <div style={{ background: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden" }}>
              {/* Calendar Header */}
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.border}`, background: "rgba(196,127,58,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: colors.text, margin: 0 }}>{monthNames[m]} {y}</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => nav(-1)} style={{ padding: "8px", background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", color: colors.textMuted", display: "flex", alignItems: "center", transition: "all 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <ChevronLeft style={{ width: "20px", height: "20px" }} />
                  </button>
                  <button onClick={() => nav(1)} style={{ padding: "8px", background: "transparent", border: "none", borderRadius: "8px", cursor: "pointer", color: colors.textMuted, display: "flex", alignItems: "center", transition: "all 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <ChevronRight style={{ width: "20px", height: "20px" }} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div style={{ padding: "24px" }}>
                {/* Day Headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "16px" }}>
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
                    <div key={d} style={{ textAlign: "center", fontSize: "12px", fontWeight: "600", color: colors.dimText", paddingBottom: "8px" }}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", marginBottom: "24px" }}>
                  {Array.from({length: firstDayMon}, (_,i) => <div key={`e${i}`} />)}
                  {Array.from({length: daysInMonth}, (_,i) => {
                    const day = i+1, key = dk(day), past = key < today, avail = availableDays.has(key), sel = key === date;
                    return (
                      <button key={day} disabled={past} onClick={() => { setDate(key); setSelectedSlot(""); setError(""); }}
                        style={{ padding: "12px 8px", borderRadius: "8px", fontWeight: sel || avail ? "600" : "400", fontSize: "14px", cursor: past ? "not-allowed" : "pointer", fontFamily: "'Inter', sans-serif", border: sel ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`, background: sel ? colors.accent : avail ? "rgba(196,127,58,0.15)" : past ? "transparent" : colors.bg, color: sel ? colors.accentText : past ? colors.dimText : avail ? colors.accent : colors.text, transition: "all 0.2s", opacity: past ? 0.5 : 1 }}
                        onMouseEnter={(e) => !past && !sel && (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                        onMouseLeave={(e) => !past && !sel && (e.currentTarget.style.background = avail ? "rgba(196,127,58,0.15)" : colors.bg)}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {date && (
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: "24px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "600", color: colors.text, marginBottom: "16px", margin: "0 0 16px" }}>
                      {new Date(date+"T00:00:00").toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"long"})}
                    </h3>
                    {loadingSlots ? (
                      <div style={{ textAlign: "center", paddingBottom: "32px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: `3px solid ${colors.border}`, borderTopColor: colors.accent, margin: "0 auto 8px", animation: "spin 1s linear infinite" }} />
                        <p style={{ color: colors.textMuted, fontSize: "14px", margin: 0 }}>Loading times...</p>
                      </div>
                    ) : slots.length === 0 ? (
                      <p style={{ color: colors.textMuted, fontSize: "14px", paddingBottom: "16px", margin: 0 }}>No available times for this date.</p>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "8px" }}>
                        {slots.map(s => (
                          <button key={s.time} onClick={() => setSelectedSlot(s.time)}
                            style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "14px", fontWeight: selectedSlot === s.time ? "600" : "400", cursor: "pointer", fontFamily: "'Inter', sans-serif", border: selectedSlot === s.time ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`, background: selectedSlot === s.time ? colors.accent : colors.bg, color: selectedSlot === s.time ? colors.accentText : colors.text, transition: "all 0.2s" }}
                            onMouseEnter={(e) => !selectedSlot && (e.currentTarget.style.background = "rgba(196,127,58,0.1)")}
                            onMouseLeave={(e) => !selectedSlot && (e.currentTarget.style.background = colors.bg)}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Booking Form */}
                {selectedSlot && (
                  <form onSubmit={handleBook} style={{ borderTop: `1px solid ${colors.border}`, paddingTop: "24px", marginTop: "24px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: "600", color: colors.text, marginBottom: "16px", margin: "0 0 16px" }}>Your Information</h3>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                      <input 
                        type="text"
                        placeholder="Full name" 
                        value={form.name} 
                        onChange={e => setForm({...form,name:e.target.value})} 
                        required
                        style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", transition: "all 0.2s" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
                      />
                      <input 
                        type="email" 
                        placeholder="Email address" 
                        value={form.email} 
                        onChange={e => setForm({...form,email:e.target.value})} 
                        required
                        style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", transition: "all 0.2s" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
                      />
                      <textarea 
                        placeholder="Additional notes (optional)" 
                        value={form.notes} 
                        onChange={e => setForm({...form,notes:e.target.value})} 
                        rows={3}
                        style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: "8px", background: colors.bg, color: colors.text, fontSize: "14px", fontFamily: "'Inter', sans-serif", outline: "none", resize: "none", transition: "all 0.2s" }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = colors.accent)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = colors.border)}
                      />
                    </div>

                    {error && (
                      <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(196,127,58,0.1)", border: `1px solid ${colors.border}`, borderRadius: "8px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <AlertCircle style={{ width: "16px", height: "16px", color: colors.accent, flexShrink: 0, marginTop: "2px" }} />
                        <p style={{ color: colors.text, fontSize: "13px", margin: 0 }}>{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={submitting} style={{ width: "100%", padding: "12px 16px", background: colors.accent, color: colors.accentText, fontWeight: "600", borderRadius: "8px", border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: "15px", fontFamily: "'Inter', sans-serif", opacity: submitting ? 0.7 : 1, transition: "all 0.2s" }}
                      onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = colors.accentHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = colors.accent)}
                    >
                      {submitting ? "Booking..." : eventType.price > 0 ? `Pay ${(eventType.price/100).toFixed(2)}$ & Confirm` : "Confirm Booking"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
