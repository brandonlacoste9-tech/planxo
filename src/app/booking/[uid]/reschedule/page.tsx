"use client";

import { useState, useEffect, use } from "react";

interface Booking {
  id: string;
  uid: string;
  title: string;
  start: string;
  end: string;
  status: string;
  eventTypeId: string;
  attendees: { name: string; email: string }[];
}

interface Slot {
  time: string;
  iso: string;
}

const TIMEZONE = "America/Toronto";

const monthNames = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

export default function ReschedulePage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ start: string; end: string } | null>(null);

  // Fetch booking by uid
  useEffect(() => {
    fetch(`/api/v2/bookings?uid=${uid}`)
      .then(r => r.json())
      .then(data => {
        const b = data?.data?.[0];
        if (!b) setError("Réservation introuvable.");
        else setBooking(b);
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [uid]);

  // Fetch available days for current month
  useEffect(() => {
    if (!booking) return;
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const padStart = new Date(y, m, -6);
    const padEnd = new Date(y, m + 1, 7);
    fetch(
      `/api/v2/slots?eventTypeId=${booking.eventTypeId}&startTime=${padStart.toISOString()}&endTime=${padEnd.toISOString()}&timeZone=${TIMEZONE}`
    )
      .then(r => r.json())
      .then(d => setAvailableDays(new Set(Object.keys(d.data || {}))))
      .catch(() => {});
  }, [currentMonth, booking]);

  // Fetch slots for selected date
  useEffect(() => {
    if (!booking || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    const sd = new Date(date + "T00:00:00");
    const ed = new Date(sd.getTime() + 86400000);
    fetch(
      `/api/v2/slots?eventTypeId=${booking.eventTypeId}&startTime=${sd.toISOString()}&endTime=${ed.toISOString()}&timeZone=${TIMEZONE}`
    )
      .then(r => r.json())
      .then(d => {
        const daySlots: string[] = d.data?.[date] || [];
        setSlots(daySlots.map((iso: string) => {
          const dt = new Date(iso);
          const parts = new Intl.DateTimeFormat("en-CA", {
            hour: "2-digit", minute: "2-digit", timeZone: TIMEZONE, hour12: false,
          }).formatToParts(dt);
          return {
            time: `${parts.find(p => p.type === "hour")?.value || "00"}:${parts.find(p => p.type === "minute")?.value || "00"}`,
            iso,
          };
        }));
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, booking]);

  async function handleReschedule() {
    if (!booking || !selectedSlot) return;
    setSubmitting(true);
    setError("");
    const slotData = slots.find(s => s.time === selectedSlot);
    const startISO = slotData?.iso || new Date(`${date}T${selectedSlot}:00`).toISOString();

    const res = await fetch(`/api/v2/bookings/${booking.id}/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startISO }),
    });
    setSubmitting(false);
    if (res.ok) {
      const json = await res.json();
      setDone({ start: json.data.start, end: json.data.end });
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json?.error?.message || "Erreur lors de la reprogrammation.");
    }
  }

  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const dk = (d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const nav = (dir: number) => { setCurrentMonth(new Date(y, m + dir, 1)); setDate(""); setSelectedSlot(""); setSlots([]); };

  if (loading) return (
    <div style={pageStyle}>
      <p style={{ color: "#c8a96e" }}>Chargement...</p>
    </div>
  );

  if (done) return (
    <div style={{ ...pageStyle, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: "#c8a96e", fontFamily: "'Cal Sans',sans-serif", fontSize: 24, marginBottom: 8 }}>
        Reprogrammé
      </h2>
      <p style={{ color: "#8a7a60", fontSize: 15, marginBottom: 6 }}>
        Votre rendez-vous a été reprogrammé avec succès.
      </p>
      <p style={{ color: "#c8a96e", fontSize: 14 }}>
        📅 {new Date(done.start).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </p>
      <p style={{ color: "#c8a96e", fontSize: 14 }}>
        🕐 {new Date(done.start).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} — {new Date(done.end).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );

  return (
    <div style={pageStyle}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 26, fontWeight: 700, color: "#c8a96e", marginBottom: 8 }}>
        Reprogrammer le rendez-vous
      </h1>
      <p style={{ color: "#8a7a60", fontSize: 14, marginBottom: 28 }}>
        Sélectionnez une nouvelle date et un nouveau créneau.
      </p>

      {error && <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</p>}

      {booking && (
        <div style={{ background: "#221608", border: "1px solid rgba(200,169,110,0.15)", borderRadius: 12, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: "#8a7a60", marginBottom: 4, fontWeight: 500 }}>Rendez-vous actuel</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#e8d5aa", marginBottom: 6 }}>{booking.title || "Rendez-vous"}</div>
          <div style={{ fontSize: 13, color: "#c8a96e" }}>
            {new Date(booking.start).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {new Date(booking.start).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div style={{ background: "#221608", border: "1px solid rgba(200,169,110,0.15)", borderRadius: 14, padding: "22px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#e8d5aa" }}>{monthNames[m]} {y}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => nav(-1)} style={navBtnStyle}>‹</button>
            <button onClick={() => nav(1)} style={navBtnStyle}>›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 10 }}>
          {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => (
            <div key={d} style={{ fontSize: 11, color: "#8a7a60", textAlign: "center", paddingBottom: 4, fontWeight: 500 }}>{d}</div>
          ))}
          {Array.from({ length: firstDayMon }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1, key = dk(day);
            const past = key < today;
            const avail = availableDays.has(key);
            const sel = key === date;
            return (
              <button
                key={day}
                disabled={past || !avail}
                onClick={() => { setDate(key); setSelectedSlot(""); setError(""); }}
                style={{
                  padding: "8px 0", borderRadius: 8,
                  border: sel ? "2px solid #c8a96e" : "none",
                  background: sel ? "rgba(200,169,110,0.18)" : avail ? "rgba(200,169,110,0.06)" : "transparent",
                  color: sel ? "#c8a96e" : past ? "#3a2e1a" : avail ? "#e8d5aa" : "#3a2e1a",
                  fontWeight: avail || sel ? 600 : 400,
                  fontSize: 13, cursor: past || !avail ? "default" : "pointer",
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>

        {date && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(200,169,110,0.1)", paddingTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8a7a60", marginBottom: 10 }}>
              {new Date(date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            {loadingSlots ? (
              <p style={{ color: "#8a7a60", fontSize: 13 }}>Chargement des créneaux...</p>
            ) : slots.length === 0 ? (
              <p style={{ color: "#8a7a60", fontSize: 13 }}>Aucun créneau disponible.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {slots.map(s => (
                  <button
                    key={s.time}
                    onClick={() => setSelectedSlot(s.time)}
                    style={{
                      padding: "8px 14px", borderRadius: 8,
                      border: selectedSlot === s.time ? "1.5px solid #c8a96e" : "1px solid rgba(200,169,110,0.2)",
                      background: selectedSlot === s.time ? "rgba(200,169,110,0.15)" : "transparent",
                      color: selectedSlot === s.time ? "#c8a96e" : "#8a7a60",
                      fontSize: 13, fontWeight: 500, cursor: "pointer",
                      fontFamily: "'Inter',sans-serif",
                    }}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
          <button
            onClick={handleReschedule}
            disabled={submitting}
            style={{
              padding: "12px 28px", borderRadius: 9, border: "none",
              background: "#c8a96e", color: "#1a1208", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1,
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {submitting ? "Reprogrammation..." : `Confirmer · ${date} à ${selectedSlot}`}
          </button>
          <button
            onClick={() => { setSelectedSlot(""); }}
            style={{
              padding: "12px 20px", borderRadius: 9,
              border: "1px solid rgba(200,169,110,0.25)",
              background: "transparent", color: "#8a7a60", fontSize: 14, fontWeight: 500,
              cursor: "pointer", fontFamily: "'Inter',sans-serif",
            }}
          >
            Changer
          </button>
        </div>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#1a1208",
  padding: "60px 24px",
  maxWidth: 560,
  margin: "0 auto",
  fontFamily: "'Inter',sans-serif",
  color: "#e8d5aa",
};

const navBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 7,
  border: "1px solid rgba(200,169,110,0.2)",
  background: "transparent", color: "#c8a96e",
  cursor: "pointer", fontSize: 14,
  display: "flex", alignItems: "center", justifyContent: "center",
};
