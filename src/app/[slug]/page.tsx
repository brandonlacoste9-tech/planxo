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
  const [showTzPicker, setShowTzPicker] = useState(false);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    try { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {}
  }, []);

  // Fetch event type
  useEffect(() => {
    fetch("/api/v2/me")
      .then((r) => r.json())
      .then((user) => {
        const et = user.eventTypes?.find((e: EventType) => e.slug === slug);
        if (et) setEventType({ ...et, user });
        else setError("Ce type de rendez-vous n'existe pas.");
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [slug]);

  // Fetch available days for visible month
  useEffect(() => {
    if (!eventType) return;
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    const padStart = new Date(y, m, -6);
    const padEnd = new Date(y, m + 1, 7);
    fetch(`/api/v2/slots?eventTypeSlug=${eventType.slug}&startTime=${padStart.toISOString()}&endTime=${padEnd.toISOString()}&timeZone=${timeZone}`)
      .then((r) => r.json())
      .then((data) => setAvailableDays(new Set(Object.keys(data.data || {}))))
      .catch(() => {});
  }, [currentMonth, eventType, timeZone]);

  // Fetch slots for selected date
  useEffect(() => {
    if (!eventType || !date) { setSlots([]); return; }
    setLoadingSlots(true);
    const sd = new Date(date + "T00:00:00");
    const ed = new Date(sd.getTime() + 86400000);
    fetch(`/api/v2/slots?eventTypeSlug=${eventType.slug}&startTime=${sd.toISOString()}&endTime=${ed.toISOString()}&timeZone=${timeZone}`)
      .then((r) => r.json())
      .then((data) => {
        const daySlots: string[] = data.data?.[date] || [];
        setSlots(daySlots.map((iso: string) => {
          const d = new Date(iso);
          const parts = new Intl.DateTimeFormat("en-CA", { hour: "2-digit", minute: "2-digit", timeZone, hour12: false }).formatToParts(d);
          const h = parts.find((p) => p.type === "hour")?.value || "00";
          const mn = parts.find((p) => p.type === "minute")?.value || "00";
          return { time: `${h}:${mn}`, iso };
        }));
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, eventType, timeZone]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !form.name || !form.email) return;
    setError(""); setSubmitting(true);
    const slotData = slots.find((s) => s.time === selectedSlot);
    const startISO = slotData?.iso || new Date(`${date}T${selectedSlot}:00`).toISOString();
    const res = await fetch("/api/v2/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startISO, eventTypeId: eventType!.id, attendee: { name: form.name, email: form.email, timeZone }, metadata: { notes: form.notes } }),
    });
    setSubmitting(false);
    if (res.status === 409) { setError("Ce créneau n'est plus disponible."); setSelectedSlot(""); return; }
    if (res.ok) {
      const json = await res.json();
      const b = json.data;
      setBooking({ status: "confirmed", guestName: b.attendees?.[0]?.name || form.name, meetingUrl: b.meetingUrl, start: b.start, end: b.end, eventTypeTitle: eventType?.title });
    } else { setError("Erreur lors de la réservation."); }
  }

  // Calendar data
  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const dayHeaders = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const isPast = (d: number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}` < today;
  const dk = (d: number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const nav = (dir: number) => { setCurrentMonth(new Date(y, m + dir, 1)); setDate(""); setSelectedSlot(""); setSlots([]); };

  const locIcon = eventType?.location === "google-meet" ? "📹 Google Meet" : eventType?.location === "phone" ? "📞 Téléphone" : eventType?.location === "zoom" ? "📹 Zoom" : eventType?.location === "teams" ? "📹 Teams" : "📍 En personne";

  // ── Confirmation ──
  if (booking?.status === "confirmed") {
    const sd = booking.start ? new Date(booking.start) : null;
    const ed = booking.end ? new Date(booking.end) : null;
    const fmt = (d: Date) => new Intl.DateTimeFormat("fr-CA", { weekday:"long",day:"numeric",month:"long",year:"numeric" }).format(d);
    const tf = (d: Date) => new Intl.DateTimeFormat("en-CA", { hour:"2-digit",minute:"2-digit",timeZone,hour12:false }).formatToParts(d);
    const tfStr = (d: Date) => { const p = tf(d); return `${p.find(x=>x.type==="hour")?.value}:${p.find(x=>x.type==="minute")?.value}`; };
    return (
      <div className="page">
        <div style={css.confirmCard}>
          <div style={css.checkmark}>✓</div>
          <h2 style={css.confirmTitle}>Rendez-vous confirmé!</h2>
          <p style={css.confirmText}>
            {booking.eventTypeTitle || eventType?.title}<br/>
            {sd ? fmt(sd) : ""} · {sd ? tfStr(sd) : ""} → {ed ? tfStr(ed) : ""}
          </p>
          {booking.meetingUrl && (
            <a href={booking.meetingUrl} target="_blank" rel="noopener" className="meeting-link">
              📹 Rejoindre la réunion →
            </a>
          )}
          <p style={css.confirmSub}>Une confirmation sera envoyée à {form.email}.</p>
          <a href={`/${slug}`} className="btn-outline">Réserver un autre</a>
        </div>
        <style href="confirm">{` .meeting-link{display:inline-block;margin-bottom:16px;padding:10px 20px;background:#ecfdf5;color:#059669;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600} .meeting-link:hover{background:#d1fae5} .btn-outline{display:inline-block;padding:12px 24px;border-radius:8px;border:1px solid rgba(0,0,0,0.12);color:#242424;text-decoration:none;font-size:14px;font-weight:600;transition:all .15s} .btn-outline:hover{background:#f9fafb;border-color:rgba(0,0,0,0.2)} `}</style>
      </div>
    );
  }

  // ── Loading ──
  if (loading) return <div className="page"><p style={css.muted}>Chargement...</p></div>;
  if (error && !eventType) return <div className="page"><p style={css.errorText}>{error}</p></div>;
  if (!eventType) return null;

  return (
    <div className="page">
      <div className="booking-layout">
        {/* ── LEFT: Host info ── */}
        <div className="host-panel">
          <div style={css.hostAvatar}>{eventType.user.name[0]}</div>
          <div style={css.hostName}>{eventType.user.name}</div>
          <h1 style={css.eventTitle}>{eventType.title}</h1>
          <div style={css.badges}>
            <span className="badge">🕐 {eventType.length} min</span>
            <span className="badge">{locIcon}</span>
            <div style={{position:"relative"}}>
              <span className="badge badge-tz" onClick={() => setShowTzPicker(!showTzPicker)}>🌍 {timeZone.replace("_"," ").split("/").pop()}</span>
              {showTzPicker && (
                <div style={css.tzDropdown}>
                  {["America/Toronto","America/New_York","America/Vancouver","America/Chicago","Europe/Paris","Europe/London","Asia/Tokyo","Australia/Sydney"].map(tz => (
                    <button key={tz} className="tz-option" onClick={() => { setTimeZone(tz); setShowTzPicker(false); }}>
                      {tz.replace("_"," ").split("/").pop()} {tz === timeZone ? "✓" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {eventType.price > 0 && <span className="badge badge-price">{(eventType.price/100).toFixed(2)} {eventType.currency.toUpperCase()}</span>}
          </div>
          {eventType.description && <p style={css.desc}>{eventType.description}</p>}
        </div>

        {/* ── RIGHT: Calendar + slots + form ── */}
        <div className="calendar-panel">
          {/* Month nav */}
          <div style={css.calHeader}>
            <button className="nav-btn" onClick={() => nav(-1)} aria-label="Mois précédent">‹</button>
            <span style={css.monthTitle}>{monthNames[m]} {y}</span>
            <button className="nav-btn" onClick={() => nav(1)} aria-label="Mois suivant">›</button>
          </div>

          {/* Day headers */}
          <div className="cal-grid">
            {dayHeaders.map(dh => <div key={dh} style={css.dayHeader}>{dh}</div>)}
            {/* Empty cells before 1st */}
            {Array.from({length: firstDayMon}, (_,i) => <div key={`e${i}`} style={css.cell} />)}
            {/* Day cells */}
            {Array.from({length: daysInMonth}, (_,i) => {
              const day = i+1, key = dk(day), past = isPast(day), avail = availableDays.has(key), sel = key === date, isT = key === today;
              let cls = "cal-day";
              if (past) cls += " cal-past";
              else if (sel) cls += " cal-sel";
              else if (isT) cls += " cal-today";
              else if (avail) cls += " cal-avail";
              return (
                <button key={day} className={cls} disabled={past}
                  onClick={() => { setDate(key); setSelectedSlot(""); setError(""); }}>
                  <span style={css.dayNum}>{day}</span>
                  {avail && !past && <span className={`cal-dot${sel ? " cal-dot-sel" : ""}`} />}
                </button>
              );
            })}
          </div>

          {/* Time slots */}
          {date && (
            <div style={{marginTop:24}}>
              <div style={css.sectionLabel}>
                {new Date(date+"T00:00:00").toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long"})}
              </div>
              {loadingSlots ? (
                <div className="slots-skeleton">
                  {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-slot" />)}
                </div>
              ) : slots.length === 0 ? (
                <p style={css.muted}>Aucun créneau disponible.</p>
              ) : (
                <div className="slot-grid">
                  {slots.map(s => (
                    <button key={s.time} className={`slot-btn${selectedSlot === s.time ? " slot-sel" : ""}`}
                      onClick={() => setSelectedSlot(s.time)}>{s.time}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Booking form */}
          {selectedSlot && (
            <form onSubmit={handleBook} style={{marginTop:24}}>
              <div style={css.sectionLabel}>Vos informations</div>
              <input className="input" placeholder="Votre nom" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required />
              <input className="input" type="email" placeholder="Votre courriel" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required />
              <textarea className="input" placeholder="Notes (optionnel)" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} rows={2} />
              {error && <p style={css.errorText}>{error}</p>}
              <button type="submit" className="submit-btn" disabled={submitting}>
                {submitting ? "Réservation en cours..." : "Confirmer le rendez-vous"}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Global CSS ── */}
      <style href="booking">{`
        .page {
          max-width: 960px; margin: 0 auto; padding: 40px 24px 80px;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #242424; background: #fff; min-height: 100vh;
        }
        .booking-layout {
          display: flex; gap: 48px; align-items: flex-start;
        }
        .host-panel {
          flex: 0 0 260px; position: sticky; top: 40px;
          padding: 28px 0;
        }
        .calendar-panel {
          flex: 1; min-width: 0;
          background: #fff; border: 1px solid rgba(0,0,0,0.08);
          border-radius: 16px; padding: 28px;
          box-shadow: rgba(0,0,0,0.03) 0px 2px 12px;
        }

        /* Calendar grid */
        .cal-grid {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px;
        }
        .cal-day {
          aspect-ratio: 1; border-radius: 10px;
          border: 1px solid transparent; background: transparent;
          cursor: pointer; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
          transition: all 0.12s; position: relative; padding: 0; color: #242424;
        }
        .cal-day:hover:not(.cal-past) { background: #f3f4f6; }
        .cal-today { border: 1px solid rgba(0,0,0,0.12); background: #f9fafb; font-weight: 600; }
        .cal-avail { font-weight: 600; }
        .cal-sel { background: #242424 !important; color: #fff !important; border-color: #242424; font-weight: 700; }
        .cal-sel .cal-dot-sel { background: #34d399 !important; }
        .cal-past { opacity: 0.22; cursor: default; }
        .cal-dot { width: 5px; height: 5px; border-radius: 50%; background: #059669; }
        .cal-dot-sel { background: #34d399; }

        /* Nav buttons */
        .nav-btn {
          width: 36px; height: 36px; border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.1); background: #fff;
          font-size: 20px; font-weight: 600; color: #242424;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', sans-serif; transition: all 0.12s;
        }
        .nav-btn:hover { background: #f3f4f6; border-color: rgba(0,0,0,0.2); }

        /* Slot grid */
        .slot-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 8px;
        }
        .slot-btn {
          padding: 10px 8px; border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.08); background: #fff;
          cursor: pointer; font-size: 14px; font-weight: 500;
          font-family: 'Inter', sans-serif; color: #242424;
          transition: all 0.12s;
        }
        .slot-btn:hover { border-color: #242424; background: #f9fafb; }
        .slot-sel, .slot-sel:hover {
          background: #242424; color: #fff; border-color: #242424; font-weight: 600;
        }

        /* Loading skeleton */
        .slots-skeleton { display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 8px; }
        .skeleton-slot {
          height: 40px; border-radius: 8px; background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
          background-size: 200% 100%; animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* Badges */
        .badge {
          font-size: 13px; font-weight: 500; color: #6b7280;
          background: #f9fafb; padding: 5px 12px; border-radius: 8px;
          white-space: nowrap; transition: background 0.12s;
        }
        .badge-tz { cursor: pointer; }
        .badge-tz:hover { background: #f0f0f0; }
        .badge-price { background: #fef3c7; color: #92400e; font-weight: 700; }

        /* Timezone dropdown */
        .tz-option {
          display: block; width: 100%; padding: 8px 14px; border: none; background: none;
          cursor: pointer; font-size: 13px; font-family: 'Inter', sans-serif; color: #242424;
          text-align: left; border-radius: 6px; transition: background 0.1s;
        }
        .tz-option:hover { background: #f3f4f6; }

        /* Form inputs */
        .input {
          width: 100%; box-sizing: border-box;
          padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.12);
          font-size: 14px; font-family: 'Inter', sans-serif; margin-bottom: 10px;
          outline: none; transition: border-color 0.15s; background: #fff;
        }
        .input:focus { border-color: #242424; }
        textarea.input { resize: vertical; min-height: 60px; }

        /* Submit */
        .submit-btn {
          width: 100%; padding: 14px; border-radius: 8px; border: none;
          background: #242424; color: #fff; font-size: 15px; font-weight: 600;
          cursor: pointer; font-family: 'Inter', sans-serif; margin-top: 8px;
          transition: all 0.15s;
        }
        .submit-btn:hover:not(:disabled) { background: #1a1a1a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .submit-btn:disabled { opacity: 0.6; cursor: default; }

        /* Responsive */
        @media (max-width: 700px) {
          .booking-layout { flex-direction: column; gap: 24px; }
          .host-panel { flex: none; position: static; padding: 0; }
          .calendar-panel { border: none; box-shadow: none; padding: 0; border-radius: 0; }
        }
      `}</style>
    </div>
  );
}

// ── Inline styles for dynamic values ──
const css: Record<string, React.CSSProperties> = {
  hostAvatar: { width:48,height:48,borderRadius:"50%",background:"#242424",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,marginBottom:12 },
  hostName: { fontSize:15,fontWeight:600,color:"#242424",marginBottom:4 },
  eventTitle: { fontFamily:"'Cal Sans','Inter',sans-serif",fontSize:22,fontWeight:700,color:"#242424",lineHeight:1.2,margin:"0 0 12px",letterSpacing:"-0.3px" },
  badges: { display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 },
  desc: { fontSize:14,color:"#6b7280",lineHeight:1.6 },
  calHeader: { display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14 },
  monthTitle: { fontSize:15,fontWeight:700,fontFamily:"'Cal Sans','Inter',sans-serif" },
  dayHeader: { fontSize:11,fontWeight:600,color:"#898989",textAlign:"center",padding:"6px 0",textTransform:"uppercase" },
  cell: { aspectRatio:"1" },
  dayNum: { fontSize:14,fontWeight:"inherit" },
  muted: { fontSize:13,color:"#898989",margin:0 },
  sectionLabel: { fontSize:14,fontWeight:600,color:"#242424",marginBottom:10 },
  errorText: { color:"#dc2626",fontSize:13,marginTop:8 },
  tzDropdown: { position:"absolute",top:"100%",left:0,marginTop:4,background:"#fff",border:"1px solid rgba(0,0,0,0.1)",borderRadius:10,padding:"6px",boxShadow:"0 4px 16px rgba(0,0,0,0.08)",zIndex:50,minWidth:180 },
  confirmCard: { textAlign:"center",padding:"60px 32px",border:"1px solid rgba(0,0,0,0.08)",borderRadius:16,maxWidth:480,margin:"0 auto" },
  checkmark: { width:64,height:64,borderRadius:"50%",background:"#ecfdf5",color:"#059669",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,margin:"0 auto 20px" },
  confirmTitle: { fontFamily:"'Cal Sans',sans-serif",fontSize:24,fontWeight:700,margin:"0 0 12px" },
  confirmText: { fontSize:16,color:"#242424",lineHeight:1.7,marginBottom:16 },
  confirmSub: { fontSize:13,color:"#898989",marginBottom:24 },
};
