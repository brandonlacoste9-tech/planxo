"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "@/lib/theme";

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

const FILTERS = [
  { value: "upcoming" as const, label: "À venir" },
  { value: "past" as const, label: "Passés" },
  { value: "cancelled" as const, label: "Annulés" },
];

export default function DashboardPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userSlug, setUserSlug] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newET, setNewET] = useState({ title: "", slug: "", length: 30, location: "google-meet", description: "" });
  const [copySuccess, setCopySuccess] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterValue>("upcoming");
  const { colors, setTheme, theme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, bookingsRes] = await Promise.all([
        fetch("/api/v2/me"),
        fetch(`/api/v2/bookings?timeFilter=${activeFilter}`)
      ]);
      const user = await userRes.json();
      const bookingsData = await bookingsRes.json();

      if (user.username) setUserSlug(user.username);
      if (user.name) setUserName(user.name);
      setEventTypes(user.eventTypes || []);
      setBookings(bookingsData.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Annuler ce rendez-vous ?")) return;
    await fetch(`/api/v2/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Annulé par l'hôte" }),
    });
    fetchData();
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
    return <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, display: "flex", alignItems: "center", justifyContent: "center" }}>Chargement...</div>;
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.bg, color: colors.text, padding: isMobile ? 20 : "40px 60px" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
        <div>
          <div style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 26, fontWeight: 700 }}>Planxo</div>
          <div style={{ color: colors.textMuted, fontSize: 13 }}>Tableau de bord</div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* Theme Selector */}
          <div style={{ display: "flex", gap: 6 }}>
            {(Object.keys({ cognac: 1, midnight: 1, ocean: 1, forest: 1 }) as any[]).map((key) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: (key === "cognac" ? "#c47f3a" : key === "midnight" ? "#6c5ce7" : key === "ocean" ? "#2d8cf0" : "#2e7d32"),
                  border: theme === key ? "2px solid #fff" : "2px solid transparent",
                  cursor: "pointer",
                  padding: 0
                }}
              />
            ))}
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, padding: "8px 14px", borderRadius: 8, color: colors.text, cursor: "pointer" }}>
            Menu
          </button>
        </div>
      </div>

      {/* Profile Banner */}
      {userSlug && (
        <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 18, marginBottom: 32, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: colors.textMuted }}>Votre lien de réservation</div>
            <div style={{ fontWeight: 600, marginTop: 4 }}>{window.location.origin}/{userSlug}</div>
          </div>
          <button onClick={() => copyLink("__profile__")} style={{ background: colors.accent, color: "#1a1008", padding: "10px 20px", borderRadius: 10, border: "none", fontWeight: 600, cursor: "pointer" }}>
            {copySuccess === "__profile__" ? "Copié !" : "Copier le lien"}
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 48 }}>
        <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{eventTypes.length}</div>
          <div style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>Types de rendez-vous</div>
        </div>
        <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{bookings.length}</div>
          <div style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>Rendez-vous</div>
        </div>
        <div style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{bookings.filter(b => b.status === "confirmed").length}</div>
          <div style={{ color: colors.textMuted, marginTop: 4, fontSize: 14 }}>Confirmés</div>
        </div>
      </div>

      {/* Event Types */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, color: colors.text }}>Types de rendez-vous</h2>
          <button onClick={() => setShowNew(!showNew)} style={{ background: colors.accent, color: "#1a1008", padding: "9px 18px", borderRadius: 10, border: "none", fontWeight: 600, cursor: "pointer" }}>
            {showNew ? "Annuler" : "+ Nouveau"}
          </button>
        </div>

        {showNew && (
          <form onSubmit={createEventType} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, padding: 22, borderRadius: 14, marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 12 }}>
              <input placeholder="Titre" value={newET.title} onChange={e => setNewET({ ...newET, title: e.target.value })} required style={{ padding: 11, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text }} />
              <input placeholder="Slug" value={newET.slug} onChange={e => setNewET({ ...newET, slug: e.target.value })} required style={{ padding: 11, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text }} />
              <button type="submit" style={{ background: colors.accent, color: "#1a1008", border: "none", borderRadius: 8, fontWeight: 600 }}>Créer</button>
            </div>
          </form>
        )}

        {eventTypes.length === 0 ? (
          <p style={{ color: colors.textMuted }}>Aucun type de rendez-vous. Créez votre premier !</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {eventTypes.map(et => (
              <div key={et.id} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{et.title}</div>
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>{et.length} min</div>
                </div>
                <button onClick={() => copyLink(et.slug)} style={{ background: colors.accent, color: "#1a1008", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer" }}>
                  {copySuccess === et.slug ? "Copié" : "Copier"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bookings */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>Rendez-vous</h2>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setActiveFilter(f.value)} style={{
              padding: "7px 16px",
              borderRadius: 999,
              border: activeFilter === f.value ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
              background: activeFilter === f.value ? colors.accent : "transparent",
              color: activeFilter === f.value ? "#1a1008" : colors.text,
              cursor: "pointer",
              fontSize: 13
            }}>
              {f.label}
            </button>
          ))}
        </div>

        {bookings.length === 0 ? (
          <p style={{ color: colors.textMuted }}>Aucun rendez-vous pour ce filtre.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {bookings.map(b => (
              <div key={b.id} style={{ background: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{b.guestName}</div>
                  <div style={{ color: colors.textMuted, fontSize: 13 }}>{b.eventType?.title} • {new Date(b.startTime).toLocaleDateString('fr-CA')}</div>
                </div>
                <button onClick={() => handleCancelBooking(b.id)} style={{ color: "#e74c3c", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Annuler</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
