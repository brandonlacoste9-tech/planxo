"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme, themes, type ThemeName } from "@/lib/theme";

interface EventType {
  id: string;
  title: string;
  slug: string;
  description: string;
  length: number;
  location: string;
  isActive: boolean;
}

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  eventTypeId?: string;
  eventType: { title: string; slug: string };
}

type FilterValue = "upcoming" | "past" | "cancelled";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "upcoming", label: "À venir" },
  { value: "past", label: "Passés" },
  { value: "cancelled", label: "Annulés" },
];

export default function DashboardPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userSlug, setUserSlug] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newET, setNewET] = useState({ title: "", slug: "", length: 30, location: "google-meet", description: "" });
  const [copySuccess, setCopySuccess] = useState("");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editSlugValue, setEditSlugValue] = useState("");
  const [shareTarget, setShareTarget] = useState<EventType | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");
  const { theme, colors, setTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const tColors = colors;

  const fetchBookings = useCallback(async (filter: FilterValue = activeFilter) => {
    setBookingsLoading(true);
    try {
      const params = filter === "cancelled"
        ? "status=cancelled"
        : `timeFilter=${filter}`;
      const d = await fetch(`/api/v2/bookings?${params}`).then((r) => r.json());
      const normalized = (d.data || []).map((b: any) => ({
        id: b.id,
        guestName: b.attendees?.[0]?.name || "",
        guestEmail: b.attendees?.[0]?.email || "",
        startTime: b.start,
        endTime: b.end,
        status: b.status === "accepted" ? "confirmed" : b.status,
        eventTypeId: b.eventTypeId,
        eventType: { title: "", slug: "" },
      }));
      setBookings(normalized);
    } finally {
      setBookingsLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile?.name) setUserName(data.profile.name);
      })
      .catch(() => {});
    fetch("/api/v2/me")
      .then((r) => r.json())
      .then((user) => {
        setEventTypes(user.eventTypes || []);
        if (user.username) setUserSlug(user.username);
        if (user.name) setUserName(user.name);
      });
    fetchBookings("upcoming").finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBookings(activeFilter);
  }, [activeFilter]);

  // Enrich bookings with event type names once both datasets are loaded
  useEffect(() => {
    if (eventTypes.length > 0 && bookings.length > 0) {
      const map = new Map(eventTypes.map((et) => [et.id, et]));
      setBookings((prev) =>
        prev.map((b) => {
          const et = map.get((b as any).eventTypeId);
          return et ? { ...b, eventType: { title: et.title, slug: et.slug } } : b;
        })
      );
    }
  }, [eventTypes, bookings.length]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Annuler ce rendez-vous ?")) return;
    await fetch(`/api/v2/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Annulé par l'hôte" }),
    });
    fetchBookings(activeFilter);
  };

  async function createEventType(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/v2/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newET),
    });
    if (res.ok) {
      const created = await res.json();
      setEventTypes([...eventTypes, created]);
      setShowNew(false);
      setNewET({ title: "", slug: "", length: 30, location: "google-meet", description: "" });
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/${userSlug}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopySuccess(slug);
    setTimeout(() => setCopySuccess(""), 2000);
  }

  if (loading) {
    return <div style={{ ...styles.container, color: tColors.text, background: tColors.bg }}><p style={styles.muted}>Chargement...</p></div>;
  }

  return (
    <div style={{ ...styles.container, color: tColors.text, background: tColors.bg }}>
      <style dangerouslySetInnerHTML={{ __html: `
              <a href="/appel-15min" className="dn-item"><span>📅</span> Appel 15 min</a>
              <a href="/consultation-30min" className="dn-item"><span>📅</span> Consultation 30 min</a>
              <a href="/reunion-1h" className="dn-item"><span>📅</span> Réunion 1h</a>
              <div style={{height:1,background:"rgba(0,0,0,0.06)",margin:"4px 0"}} />
              <a href="/api/v2/me" className="dn-item"><span>🔑</span> API</a>
              <div style={{height:1,background:"rgba(0,0,0,0.06)",margin:"4px 0"}} />
              <div style={{padding:"8px 14px"}}>
                <div style={{fontSize:11,fontWeight:600,color:"#898989",textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Theme</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {(Object.entries(themes) as [ThemeName, typeof themes.default][]).map(([key, t]) => (
                    <button key={key} onClick={() => setTheme(key)} title={t.name}
                      style={{width:24,height:24,borderRadius:"50%",background:t.accent,border:theme===key?"2px solid white":"2px solid transparent",outline:theme===key?`2px solid ${t.accent}`:"none",cursor:"pointer",padding:0,boxShadow:theme===key?`0 0 0 2px ${t.accent}`:"none"}}
                    />
                  ))}
                </div>
              </div>
              <div style={{height:1,background:"rgba(0,0,0,0.06)",margin:"4px 0"}} />
              <a href="/" className="dn-item"><span>🏠</span> Accueil</a>
            </div>
          </div>
        </div>
      )}

      {/* Mobile username label */}
      {isMobile && (
        <p style={{ ...styles.muted, marginBottom: 16 }}>{userName ? `${userName} — Tableau de bord` : "Tableau de bord"}</p>
      )}

      {/* Profile link banner */}
      {userSlug && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: tColors.cardBg,
          border: `1px solid ${tColors.border}`,
          borderRadius: 12, padding: "14px 18px", marginBottom: 20,
          flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: tColors.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
              🔗 Mon lien de réservation
            </div>
            <div style={{
              fontSize: 14, fontWeight: 500, color: tColors.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {typeof window !== "undefined" ? `${window.location.origin}/${userSlug}` : `rdv-qc.vercel.app/${userSlug}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => {
                const url = `${window.location.origin}/${userSlug}`;
                navigator.clipboard.writeText(url);
                setCopySuccess("__profile__");
                setTimeout(() => setCopySuccess(""), 2000);
              }}
              style={{
                padding: "8px 16px", borderRadius: 8,
                background: copySuccess === "__profile__" ? "#2a6e3a" : tColors.accent,
                color: copySuccess === "__profile__" ? "#fff" : (dark ? "#1a1208" : "#fff"),
                border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "Inter, sans-serif", whiteSpace: "nowrap", transition: "background 0.2s",
              }}
            >
              {copySuccess === "__profile__" ? "✓ Copié !" : "Copier le lien"}
            </button>
            <a
              href={`/${userSlug}`}
              target="_blank"
              style={{
                padding: "8px 14px", borderRadius: 8,
                border: `1px solid ${tColors.border}`,
                color: tColors.textMuted, fontSize: 13, textDecoration: "none",
                display: "flex", alignItems: "center", whiteSpace: "nowrap",
              }}
            >
              Voir ↗
            </a>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ ...styles.statsRow, gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{eventTypes.length}</div>
          <div style={styles.statLabel}>Types de rendez-vous</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{bookings.length}</div>
          <div style={styles.statLabel}>Rendez-vous</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>
            {bookings.filter((b) => b.status === "confirmed").length}
          </div>
          <div style={styles.statLabel}>Confirmés</div>
        </div>
      </div>

      {/* Calendar Connect */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Calendriers</h2>
        <p style={styles.muted}>Votre calendrier Planxo est actif par défaut — définissez vos disponibilités dans les paramètres. Connectez Google ou Outlook pour synchroniser automatiquement vos indisponibilités.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Planxo native calendar badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0",
          }}>
            <span style={{ fontSize: 18 }}>📅</span> Planxo Calendar
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.7 }}>(actif)</span>
          </div>
          <a href="/api/auth/google" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: "none", background: "#241810", color: colors.text,
            border: "1px solid rgba(0,0,0,0.12)",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Google
          </a>
          <a href="/api/auth/outlook" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600,
            textDecoration: "none", background: "#0078D4", color: "#fff",
            border: "none",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#fff" d="M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zm0 16H3V7h18v12z"/><path fill="#0078D4" d="M3 7h18v2H3z"/></svg>
            Outlook
          </a>
        </div>
        <p style={{ fontSize: 12, color: "#898989", marginTop: 8 }}>
          <a href="/availability" style={{ color: "#0099ff", textDecoration: "underline" }}>Configurer vos disponibilités →</a>
        </p>
      </div>

      {/* Event Types */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.h2}>Types de rendez-vous</h2>
          <button style={styles.primaryBtn} onClick={() => setShowNew(!showNew)}>
            {showNew ? "Annuler" : "+ Nouveau"}
          </button>
        </div>

        {showNew && (
          <form onSubmit={createEventType} style={styles.form}>
            <input
              style={styles.input}
              placeholder="Titre (ex: Consultation 30min)"
              value={newET.title}
              onChange={(e) => {
                const title = e.target.value;
                setNewET({
                  ...newET,
                  title,
                  slug: title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
                });
              }}
              required
            />
            <div style={{ ...styles.formRow, flexDirection: isMobile ? "column" : "row" }}>
              <select style={styles.select} value={newET.length} onChange={(e) => setNewET({ ...newET, length: Number(e.target.value) })}>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
                <option value={90}>90 minutes</option>
              </select>
              <select style={styles.select} value={newET.location} onChange={(e) => setNewET({ ...newET, location: e.target.value })}>
                <option value="google-meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="phone">Téléphone</option>
                <option value="in-person">En personne</option>
              </select>
            </div>
            <input
              style={styles.input}
              placeholder="Description (optionnel)"
              value={newET.description}
              onChange={(e) => setNewET({ ...newET, description: e.target.value })}
            />
            <button type="submit" style={styles.primaryBtn}>Créer</button>
          </form>
        )}

        <div style={{ ...styles.eventGrid, width: isMobile ? "100%" : undefined }}>
          {eventTypes.map((et) => (
            <div key={et.id} style={{ ...styles.eventCard, flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 12 : undefined }}>
              <div style={{ flex: 1 }}>
                <h3 style={styles.h3}>{et.title}</h3>
                <p style={styles.muted}>{et.length} min · {et.location === "google-meet" ? "Google Meet" : et.location === "phone" ? "Téléphone" : et.location === "zoom" ? "Zoom" : "En personne"}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: "#898989" }}>planxo.ca/</span>
                  {editingSlug === et.id ? (
                    <input autoFocus value={editSlugValue}
                      onChange={e => setEditSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      onBlur={async () => {
                        if (editSlugValue && editSlugValue !== et.slug) {
                          await fetch(`/api/v2/event-types/${et.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: editSlugValue }) });
                          setEventTypes(prev => prev.map(e => e.id === et.id ? { ...e, slug: editSlugValue } : e));
                        }
                        setEditingSlug(null);
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      style={{ fontSize: 13, fontWeight: 600, color: colors.text, border: "1px solid rgba(0,0,0,0.2)", borderRadius: 6, padding: "2px 8px", width: 140, fontFamily: "'Inter',sans-serif", outline: "none" }}
                    />
                  ) : (
                    <span onClick={() => { setEditingSlug(et.id); setEditSlugValue(et.slug); }}
                      style={{ fontSize: 13, fontWeight: 600, color: colors.text, cursor: "pointer", borderBottom: "1px dashed rgba(0,0,0,0.2)" }}
                      title="Cliquer pour modifier"
                    >{et.slug}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <a href={`/event-types/${et.id}`}
                  style={{ ...styles.copyBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                  title="Modifier les paramètres avancés"
                >
                  ✏️ Modifier
                </a>
                <button style={copySuccess === et.slug ? styles.copiedBtn : styles.copyBtn}
                  onClick={() => copyLink(et.slug)}
                >{copySuccess === et.slug ? "✓ Copié!" : "Copier"}</button>
                <button style={{ ...styles.copyBtn, background: "#f9fafb" }}
                  onClick={() => setShareTarget(et)}
                >Partager</button>
              </div>
            </div>
          ))}
          {eventTypes.length === 0 && (
            <p style={styles.muted}>Aucun type de rendez-vous. Créez votre premier!</p>
          )}
        </div>
      </div>

      {/* Upcoming Bookings */}
      <div style={styles.section}>
        <h2 style={styles.h2}>Rendez-vous</h2>

        {/* Filter tabs — scrollable on mobile */}
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          flexWrap: isMobile ? "nowrap" : "wrap",
          overflowX: isMobile ? "auto" : "visible",
          paddingBottom: isMobile ? 4 : 0,
          WebkitOverflowScrolling: "touch",
        }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{
                padding: "7px 18px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.15s",
                flexShrink: 0,
                border: activeFilter === f.value
                  ? "1.5px solid #8a7a60"
                  : "1.5px solid rgba(0,0,0,0.08)",
                background: activeFilter === f.value ? "rgba(138,122,96,0.08)" : "#f9fafb",
                color: activeFilter === f.value ? "#8a7a60" : "#898989",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={styles.bookingList}>
          {bookingsLoading ? (
            <p style={styles.muted}>Chargement...</p>
          ) : bookings.length === 0 ? (
            <p style={styles.muted}>Aucun rendez-vous.</p>
          ) : (
            bookings.map((b) => (
              <div key={b.id} style={{
                ...styles.bookingCard,
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "flex-start" : "center",
                gap: isMobile ? 10 : 16,
                width: isMobile ? "100%" : undefined,
              }}>
                <div style={styles.bookingLeft}>
                  <div style={styles.avatar}>{b.guestName[0] || "?"}</div>
                  <div>
                    <div style={styles.guestName}>{b.guestName}</div>
                    <div style={styles.muted}>{b.guestEmail}</div>
                  </div>
                </div>
                <div style={{ ...styles.bookingRight, textAlign: isMobile ? "left" : "right" }}>
                  <div style={styles.bookingType}>{b.eventType.title}</div>
                  <div style={styles.bookingTime}>
                    {new Date(b.startTime).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}
                    {new Date(b.startTime).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{
                    ...styles.badge,
                    background: b.status === "confirmed" ? "#ecfdf5" : b.status === "cancelled" ? "#fef2f2" : "#fefce8",
                    color: b.status === "confirmed" ? "#059669" : b.status === "cancelled" ? "#dc2626" : "#b45309",
                  }}>
                    {b.status === "confirmed" ? "Confirmé" : b.status === "cancelled" ? "Annulé" : b.status}
                  </span>
                  {activeFilter === "upcoming" && (
                    <button
                      onClick={() => handleCancelBooking(b.id)}
                      style={{ fontSize: 12, color: "#8a7a60", background: "transparent", border: "1px solid rgba(138,122,96,0.2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Share Drawer */}
      {shareTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200,
          display: "flex", justifyContent: "flex-end",
        }} onClick={() => setShareTarget(null)}>
          <div style={{
            width: "100%", maxWidth: isMobile ? "100%" : 440, background: "#241810", height: "100%",
            padding: isMobile ? "24px 16px" : "32px 28px", overflow: "auto", fontFamily: "'Inter',sans-serif",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 22, fontWeight: 700, margin: 0 }}>Partager</h2>
              <button onClick={() => setShareTarget(null)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#898989", padding: 0 }}>×</button>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{shareTarget.title}</h3>
            <p style={{ fontSize: 13, color: "#898989", marginBottom: 24 }}>{shareTarget.length} min</p>

            {/* Copy link */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#898989", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Lien direct</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input readOnly value={`${window.location.origin}/${userSlug}/${shareTarget.slug}`}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", fontSize: 13, fontFamily: "'Inter',sans-serif", background: "#f9fafb" }}
                  onFocus={e => e.target.select()}
                />
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${userSlug}/${shareTarget.slug}`); setCopySuccess(shareTarget.slug); setTimeout(() => setCopySuccess(""), 2000); }}
                  style={{ padding: "10px 18px", borderRadius: 8, background: "#242424", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" }}>
                  {copySuccess === shareTarget.slug ? "✓" : "Copier"}
                </button>
              </div>
            </div>

            {/* Email preview */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#898989", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Insérer dans un courriel</div>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16, border: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: colors.text, lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Réservez un {shareTarget.title} avec moi :</p>
                <p style={{ margin: "0 0 8px" }}>Choisissez un créneau qui vous convient → <a href={`${window.location.origin}/${userSlug}/${shareTarget.slug}`} style={{ color: "#0099ff" }}>rdv-qc.vercel.app/{userSlug}/{shareTarget.slug}</a></p>
                <p style={{ margin: 0, color: "#898989", fontSize: 12 }}>— Planxo</p>
              </div>
              <button onClick={() => {
                const text = `Réservez un ${shareTarget.title} avec moi :\n\nChoisissez un créneau qui vous convient → ${window.location.origin}/${userSlug}/${shareTarget.slug}\n\n— Planxo`;
                navigator.clipboard.writeText(text);
              }}
                style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter',sans-serif", color: colors.text }}>
                Copier le texte
              </button>
            </div>

            {/* Embed */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#898989", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Intégrer sur votre site</div>
              <div style={{ background: "#f9fafb", borderRadius: 10, padding: 16, border: "1px solid rgba(0,0,0,0.06)" }}>
                <code style={{ fontSize: 12, color: colors.text, wordBreak: "break-all", fontFamily: "monospace" }}>
                  {`<iframe src="${window.location.origin}/${userSlug}/${shareTarget.slug}" width="100%" height="600" frameborder="0"></iframe>`}
                </code>
              </div>
              <button onClick={() => {
                navigator.clipboard.writeText(`<iframe src="${window.location.origin}/${userSlug}/${shareTarget.slug}" width="100%" height="600" frameborder="0"></iframe>`);
              }}
                style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, background: "#f9fafb", border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "'Inter',sans-serif", color: colors.text }}>
                Copier le code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1280,
    width: "100%",
    margin: "0 auto",
    padding: "24px 16px 80px",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    position: "relative" as const,
    zIndex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  h1: {
    fontFamily: "'Cal Sans', 'Inter', sans-serif",
    fontSize: 28,
    fontWeight: 700,
    color: colors.text,
    margin: 0,
    letterSpacing: "-0.5px",
  },
  h2: {
    fontFamily: "'Cal Sans', 'Inter', sans-serif",
    fontSize: 22,
    fontWeight: 700,
    color: "#c8b8a0",
    margin: "0 0 16px",
  },
  h3: {
    fontFamily: "'Cal Sans', 'Inter', sans-serif",
    fontSize: 16,
    fontWeight: 700,
    color: "#c8b8a0",
    margin: 0,
  },
  muted: { fontSize: 14, color: "#898989", margin: "4px 0 0" },
  backLink: { color: "#898989", textDecoration: "none", fontSize: 14, fontWeight: 500 },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 48 },
  statCard: {
    padding: 24,
    borderRadius: 12,
    background: "#241810",
    textAlign: "center" as const,
  },
  statNumber: { fontSize: 36, fontWeight: 700, color: colors.text, fontFamily: "'Cal Sans', sans-serif" },
  statLabel: { fontSize: 13, color: "#898989", marginTop: 4, fontWeight: 500 },
  section: { marginBottom: 48 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  primaryBtn: {
    background: colors.accent,
    color: "#1a1008",
    padding: "10px 20px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  eventGrid: { display: "flex", flexDirection: "column" as const, gap: 8 },
  eventCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "#241810",
  },
  copyBtn: {
    background: "#f9fafb",
    color: colors.text,
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    border: "1px solid rgba(0,0,0,0.08)",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  copiedBtn: {
    background: "#ecfdf5",
    color: "#059669",
    padding: "8px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    border: "1px solid #a7f3d0",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
  form: {
    background: "#f9fafb",
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column" as const,
    gap: 12,
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.1)",
    fontSize: 14,
    fontFamily: "'Inter', sans-serif",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
  statCard: { padding: 28, borderRadius: 16, background: "#1f160f", border: "1px solid #3a2a1f", textAlign: "center" as const },
    flex: 1,
  },
  formRow: { display: "flex", gap: 12 },
  bookingList: { display: "flex", flexDirection: "column" as const, gap: 8 },
  bookingCard: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 20px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "#241810",
  },
  bookingLeft: { display: "flex", alignItems: "center", gap: 12, flex: 1 },
  avatar: {
    width: 36, height: 36, borderRadius: "50%",
    background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, color: "#6b7280", flexShrink: 0,
  },
  guestName: { fontSize: 14, fontWeight: 600, color: colors.text },
  bookingRight: { textAlign: "right" as const },
  bookingType: { fontSize: 13, fontWeight: 500, color: colors.text },
  bookingTime: { fontSize: 13, color: "#898989", marginTop: 2 },
  badge: {
    padding: "4px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
};
