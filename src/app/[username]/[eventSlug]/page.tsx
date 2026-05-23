"use client";

import { useState, useEffect, use } from "react";

interface EventType {
  id: string; title: string; slug: string; description: string;
  length: number; location: string; price: number; currency: string;
  user: { name: string; username: string; timeZone: string };
}

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

  useEffect(() => { try { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch {} }, []);

  useEffect(() => {
    // Handle Stripe return
    const q = new URLSearchParams(window.location.search);
    if (q.get("booking") === "success") { setBooking({ status: "paid", guestName: form.name || "", eventTypeTitle: eventType?.title || "" }); window.history.replaceState({}, "", `/${username}/${eventSlug}`); return; }
    if (q.get("booking") === "cancelled") { setError("Paiement annulé."); window.history.replaceState({}, "", `/${username}/${eventSlug}`); return; }
  }, [username, eventSlug, eventType]);

  // Fetch event type by username + slug
  useEffect(() => {
    fetch(`/api/v2/me?username=${username}`)
      .then(r => r.json())
      .then(user => {
        if (user.error) { setError("Utilisateur introuvable."); setLoading(false); return; }
        // Fetch event types for this user
        return fetch(`/api/v2/event-types?userId=${user.id}`);
      })
      .then(r => r?.json())
      .then(data => {
        const et = data?.data?.find((e: any) => e.slug === eventSlug);
        if (et) setEventType({ ...et, user: { name: et.user?.name || username, username, timeZone: et.user?.timeZone || "America/Toronto" } });
        else setError("Ce type de rendez-vous n'existe pas.");
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [username, eventSlug]);

  // Fetch available days
  useEffect(() => {
    if (!eventType) return;
    const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
    const padStart = new Date(y, m, -6), padEnd = new Date(y, m + 1, 7);
    fetch(`/api/v2/slots?eventTypeId=${eventType.id}&startTime=${padStart.toISOString()}&endTime=${padEnd.toISOString()}&timeZone=${timeZone}`)
      .then(r => r.json()).then(d => setAvailableDays(new Set(Object.keys(d.data || {})))).catch(() => {});
  }, [currentMonth, eventType, timeZone]);

  // Fetch slots for selected date
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
      else { const err = await res.json(); setError(err.error || "Erreur de paiement."); }
      return;
    }

    const res = await fetch("/api/v2/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start: startISO, eventTypeId: eventType!.id, attendee: { name: form.name, email: form.email, timeZone }, metadata: { notes: form.notes } }),
    });
    setSubmitting(false);
    if (res.status === 409) { setError("Ce créneau n'est plus disponible."); setSelectedSlot(""); return; }
    if (res.ok) {
      const json = await res.json(); const b = json.data;
      setBooking({ status: "confirmed", uid: b.uid, guestName: b.attendees?.[0]?.name || form.name, meetingUrl: b.meetingUrl, start: b.start, end: b.end, eventTypeTitle: eventType?.title });
    } else setError("Erreur lors de la réservation.");
  }

  const y = currentMonth.getFullYear(), m = currentMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay(), firstDayMon = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const monthNames = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
  const dk = (d: number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const nav = (dir: number) => { setCurrentMonth(new Date(y, m + dir, 1)); setDate(""); setSelectedSlot(""); setSlots([]); };
  const locIcon = eventType?.location === "google-meet" ? "📹 Google Meet" : eventType?.location === "phone" ? "📞 Téléphone" : eventType?.location === "zoom" ? "📹 Zoom" : eventType?.location === "teams" ? "📹 Teams" : "📍 En personne";
  const ALL_TIMEZONES: string[] = typeof Intl !== 'undefined' && (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf('timeZone')
    : ['America/Toronto','America/New_York','America/Vancouver','Europe/Paris'];

  if (booking?.status === "confirmed" || booking?.status === "paid") {
    const sd = booking.start ? new Date(booking.start) : null;
    const ed = booking.end ? new Date(booking.end) : null;
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "60px 24px", textAlign: "center", fontFamily: "'Inter',sans-serif", minHeight: "100vh", background: "#fff", position: "relative", zIndex: 1 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: booking.status === "paid" ? "#fef3c7" : "#ecfdf5", color: booking.status === "paid" ? "#92400e" : "#059669", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, marginBottom: 20 }}>{booking.status === "paid" ? "💳" : "✓"}</div>
        <h2 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 24, fontWeight: 700 }}>{booking.status === "paid" ? "Paiement réussi!" : "Rendez-vous confirmé!"}</h2>
        <p style={{ color: "#898989", fontSize: 15 }}>{booking.eventTypeTitle || eventType?.title}<br/>{sd?.toLocaleDateString("fr-CA", { weekday:"long",day:"numeric",month:"long" })}</p>
        {booking.meetingUrl && <a href={booking.meetingUrl} target="_blank" style={{ display:"inline-block",marginBottom:16,padding:"10px 20px",background:"#ecfdf5",color:"#059669",borderRadius:8,textDecoration:"none",fontSize:14,fontWeight:600 }}>📹 Rejoindre la réunion →</a>}
        <p style={{ fontSize:13,color:"#898989",margin:"16px 0" }}>Confirmation envoyée à {form.email}.</p>
        {booking.uid && (
          <div style={{marginTop:20, display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap'}}>
            <a href={`/booking/${booking.uid}/reschedule`} style={{fontSize:13, color:'#c8a96e', textDecoration:'none'}}>🔄 Reprogrammer</a>
            <a href={`/booking/${booking.uid}/cancel`} style={{fontSize:13, color:'#8a7a60', textDecoration:'none'}}>✕ Annuler</a>
          </div>
        )}
        <a href={`/${username}/${eventSlug}`} style={{ display:"inline-block",padding:"12px 24px",borderRadius:8,border:"1px solid rgba(0,0,0,0.12)",color:"#242424",textDecoration:"none",fontSize:14,fontWeight:600,marginTop:16 }}>Réserver un autre</a>
      </div>
    );
  }

  if (loading) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",position:"relative",zIndex:1 }}><p style={{color:"#898989"}}>Chargement...</p></div>;
  if (error || !eventType) return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",position:"relative",zIndex:1 }}><p style={{color:"#dc2626"}}>{error || "Type introuvable"}</p></div>;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px 80px", fontFamily: "'Inter',sans-serif", color: "#242424", background: "#fff", minHeight: "100vh", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Host panel */}
        <div style={{ flex: "0 0 260px" }}>
          <div style={{ width:48,height:48,borderRadius:"50%",background:"#242424",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,marginBottom:12 }}>{eventType.user.name[0]}</div>
          <div style={{ fontSize:15,fontWeight:600,marginBottom:4 }}>{eventType.user.name}</div>
          <h1 style={{ fontFamily:"'Cal Sans',sans-serif",fontSize:22,fontWeight:700,margin:"0 0 12px" }}>{eventType.title}</h1>
          {eventType && (
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
              {[15, 30, 45, 60].map(d => (
                <span key={d} style={{
                  padding:'5px 14px', borderRadius:9999,
                  border: d === eventType.length ? '1.5px solid #c8a96e' : '1px solid rgba(200,169,110,0.15)',
                  color: d === eventType.length ? '#c8a96e' : '#6a5a40',
                  fontSize:13, fontWeight: d === eventType.length ? 600 : 400,
                  background: d === eventType.length ? 'rgba(200,169,110,0.08)' : 'transparent',
                }}>{d === 60 ? '1h' : `${d}m`}</span>
              ))}
            </div>
          )}
          <div style={{ display:"flex",gap:6,flexWrap:"wrap",marginBottom:16 }}>
            <span style={{ fontSize:13,color:"#6b7280",background:"#f9fafb",padding:"5px 12px",borderRadius:8 }}>🕐 {eventType.length} min</span>
            <span style={{ fontSize:13,color:"#6b7280",background:"#f9fafb",padding:"5px 12px",borderRadius:8 }}>{locIcon}</span>
            <div style={{position:"relative"}}>
              <span style={{ fontSize:13,color:"#6b7280",background:"#f9fafb",padding:"5px 12px",borderRadius:8,display:"inline-flex",alignItems:"center",gap:4 }}>
                🌍
                <select value={timeZone} onChange={e => setTimeZone(e.target.value)} style={{ fontSize:13,color:"#6b7280",background:"transparent",border:"none",outline:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:0,maxWidth:140 }}>
                  {ALL_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </span>
            </div>
            {eventType.price > 0 && <span style={{ fontSize:13,background:"#fef3c7",color:"#92400e",fontWeight:700,padding:"5px 12px",borderRadius:8 }}>{(eventType.price/100).toFixed(2)} {eventType.currency.toUpperCase()}</span>}
          </div>
          {eventType.description && <p style={{ fontSize:14,color:"#6b7280",lineHeight:1.6 }}>{eventType.description}</p>}
        </div>

        {/* Calendar + slots */}
        <div style={{ flex: 1, minWidth: 300, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, padding: 28 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <span style={{ fontSize:14,fontWeight:600 }}>{monthNames[m]} {y}</span>
            <div style={{ display:"flex",gap:4 }}>
              <button onClick={() => nav(-1)} style={{ width:28,height:28,borderRadius:7,border:"1px solid rgba(0,0,0,0.1)",background:"#fff",cursor:"pointer",fontSize:14 }}>‹</button>
              <button onClick={() => nav(1)} style={{ width:28,height:28,borderRadius:7,border:"1px solid rgba(0,0,0,0.1)",background:"#fff",cursor:"pointer",fontSize:14 }}>›</button>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:16 }}>
            {["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(d => <div key={d} style={{ fontSize:11,color:"#898989",textAlign:"center",paddingBottom:4,fontWeight:500 }}>{d}</div>)}
            {Array.from({length: firstDayMon}, (_,i) => <div key={`e${i}`} />)}
            {Array.from({length: daysInMonth}, (_,i) => {
              const day = i+1, key = dk(day), past = key < today, avail = availableDays.has(key), sel = key === date;
              return (
                <button key={day} disabled={past} onClick={() => { setDate(key); setSelectedSlot(""); setError(""); }}
                  style={{ padding:"8px 0",borderRadius:8,border:sel?"2px solid #242424":"none",background:sel?"#242424":avail?"#f0fdf4":past?"transparent":"#fff",color:sel?"#fff":past?"#d1d5db":avail?"#059669":"#242424",fontWeight:avail||sel?600:400,fontSize:13,cursor:past?"default":"pointer",fontFamily:"'Inter',sans-serif" }}>
                  {day}
                </button>
              );
            })}
          </div>
          {date && (
            <div>
              <div style={{ fontSize:12,fontWeight:600,color:"#898989",marginBottom:10 }}>{new Date(date+"T00:00:00").toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long"})}</div>
              {loadingSlots ? <p style={{ color:"#898989",fontSize:13 }}>Chargement...</p> : slots.length === 0 ? <p style={{ color:"#898989",fontSize:13 }}>Aucun créneau.</p> : (
                <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                  {slots.map(s => (
                    <button key={s.time} onClick={() => setSelectedSlot(s.time)}
                      style={{ padding:"8px 12px",borderRadius:8,border:selectedSlot===s.time?"2px solid #242424":"1px solid rgba(0,0,0,0.08)",background:selectedSlot===s.time?"#242424":"#fff",color:selectedSlot===s.time?"#fff":"#242424",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>{s.time}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedSlot && (
            <form onSubmit={handleBook} style={{ marginTop: 24 }}>
              <div style={{ fontSize:14,fontWeight:600,marginBottom:10 }}>Vos informations</div>
              <input style={inputStyle} placeholder="Votre nom" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required />
              <input style={inputStyle} type="email" placeholder="Votre courriel" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required />
              <textarea style={inputStyle} placeholder="Notes (optionnel)" value={form.notes} onChange={e => setForm({...form,notes:e.target.value})} rows={2} />
              {error && <p style={{ color:"#dc2626",fontSize:13 }}>{error}</p>}
              <button type="submit" disabled={submitting} style={{ width:"100%",padding:14,borderRadius:8,border:"none",background:"#242424",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif" }}>
                {submitting ? "Réservation..." : eventType!.price > 0 ? `Payer ${(eventType!.price/100).toFixed(0)}$ · Confirmer` : "Confirmer le rendez-vous"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.12)", fontSize: 14, fontFamily: "'Inter', sans-serif",
  outline: "none", marginBottom: 10,
};
