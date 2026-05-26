"use client";
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTheme } from "@/lib/theme";
import { Copy, Check, ExternalLink } from "lucide-react";

type Tab = "profile" | "calendars" | "conferencing" | "api" | "appearance";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("profile");
  const [user, setUser] = useState<any>(null);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  // Profile controlled state
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [timeZone, setTimeZone] = useState("America/Toronto");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Conferencing controlled state
  const [conferencing, setConferencing] = useState("Google Meet");

  useEffect(() => {
    fetch("/api/v2/me")
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setEventTypes(data.eventTypes || []);
        if (data.name !== undefined) setName(data.name || "");
        if (data.username !== undefined) setUsername(data.username || "");
        if (data.timeZone) setTimeZone(data.timeZone);
        if (data.conferencing) setConferencing(data.conferencing);
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await fetch("/api/v2/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, timeZone }),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveConferencing(value: string) {
    setConferencing(value);
    try {
      await fetch("/api/v2/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conferencing: value }),
      });
    } catch {
      // silent
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "profile", label: "Profil", icon: "👤" },
    { key: "calendars", label: "Calendriers", icon: "📅" },
    { key: "conferencing", label: "Visioconférence", icon: "📹" },
    { key: "api", label: "API & Dev", icon: "🔑" },
    { key: "appearance", label: "Apparence", icon: "🎨" },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ padding: 24, color: colors.textMuted }}>Chargement...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px 80px" }}>
        
        {/* Horizontal Tabs */}
        <div style={{
          display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 32,
          borderBottom: `1px solid ${colors.border}`,
          scrollbarWidth: "none"
        }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 16px", borderRadius: 8, border: "none",
                background: tab === t.key ? `${colors.accent}15` : "transparent",
                color: tab === t.key ? colors.accent : colors.textMuted,
                fontWeight: tab === t.key ? 600 : 500,
                fontSize: 14, cursor: "pointer", whiteSpace: "nowrap",
                transition: "all .2s",
                boxShadow: tab === t.key ? `inset 0 0 0 1px ${colors.accent}40` : "none"
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <ProfileSection
            user={user} colors={colors}
            name={name} setName={setName}
            username={username} setUsername={setUsername}
            timeZone={timeZone} setTimeZone={setTimeZone}
            savingProfile={savingProfile} profileSaved={profileSaved}
            saveProfile={saveProfile}
          />
        )}
        {tab === "calendars" && <CalendarsSection colors={colors} />}
        {tab === "conferencing" && (
          <ConferencingSection colors={colors} conferencing={conferencing} saveConferencing={saveConferencing} />
        )}
        {tab === "api" && <APISection colors={colors} eventTypes={eventTypes} username={user?.username} />}
        {tab === "appearance" && <AppearanceSection colors={colors} />}

      </div>
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

function ProfileSection({
  user, colors,
  name, setName, username, setUsername, timeZone, setTimeZone,
  savingProfile, profileSaved, saveProfile,
}: any) {
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6, color: colors.text }}>Profil</h1>
      <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28 }}>Gérez vos informations personnelles.</p>
      
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.cardBg }}>
        <div style={{ display: "grid", gap: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 6 }}>Nom complet</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 15, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 6 }}>Nom d'utilisateur</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 15, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 6 }}>Courriel</label>
            <input type="email" defaultValue={user?.email} readOnly
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: `${colors.bg}80`, color: colors.textMuted, fontSize: 15, outline: "none" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 6 }}>Fuseau horaire</label>
            <select
              value={timeZone} onChange={e => setTimeZone(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, color: colors.text, fontSize: 15, outline: "none" }}
            >
              <option>America/Toronto</option>
              <option>America/New_York</option>
              <option>America/Vancouver</option>
              <option>America/Chicago</option>
              <option>Europe/Paris</option>
              <option>Europe/London</option>
            </select>
          </div>
        </div>
        
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={saveProfile} disabled={savingProfile}
            style={{
              background: colors.accent, color: colors.accentText, border: "none",
              borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600,
              cursor: savingProfile ? "not-allowed" : "pointer", opacity: savingProfile ? 0.7 : 1, transition: "opacity .2s"
            }}
          >
            {savingProfile ? "Enregistrement..." : "Enregistrer"}
          </button>
          {profileSaved && <span style={{ fontSize: 14, color: "#10b981", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><Check size={16} /> Enregistré</span>}
        </div>
      </div>
    </div>
  );
}

function CalendarsSection({ colors }: any) {
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6, color: colors.text }}>Calendriers connectés</h1>
      <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28 }}>Connectez vos calendriers pour synchroniser vos disponibilités.</p>
      
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.cardBg }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a href="/api/auth/google" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 10, background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, fontSize: 14, fontWeight: 600, textDecoration: "none", width: "fit-content" }}>
            🔵 Connecter Google Calendar
          </a>
          <a href="/api/auth/outlook" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 10, background: "#0078D4", border: "none", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", width: "fit-content" }}>
            🔷 Connecter Outlook Calendar
          </a>
        </div>
      </div>
    </div>
  );
}

function ConferencingSection({ colors, conferencing, saveConferencing }: any) {
  const options = [
    { label: "Google Meet", icon: "📹" },
    { label: "Zoom", icon: "🎥" },
    { label: "Microsoft Teams", icon: "💜" },
    { label: "Téléphone", icon: "📞" },
  ];
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6, color: colors.text }}>Visioconférence</h1>
      <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28 }}>Configurez votre plateforme par défaut.</p>
      
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.cardBg }}>
        {options.map((opt, idx) => (
          <label key={opt.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", borderBottom: idx === options.length - 1 ? "none" : `1px solid ${colors.border}`, cursor: "pointer" }}>
            <input
              type="radio" name="conferencing"
              checked={conferencing === opt.label}
              onChange={() => saveConferencing(opt.label)}
              style={{ accentColor: colors.accent, width: 18, height: 18 }}
            />
            <span style={{ fontSize: 18 }}>{opt.icon}</span>
            <span style={{ fontSize: 15, color: colors.text, fontWeight: 500 }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function APISection({ colors, eventTypes, username }: any) {
  const [copied, setCopied] = useState(false);
  const apiKey = "cal_live_planxo_demo_key";

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 6, color: colors.text }}>API & Développeurs</h1>
      <p style={{ fontSize: 15, color: colors.textMuted, marginBottom: 32 }}>Intégrez Planxo dans vos propres applications avec notre API v2 compatible Cal.com.</p>
      
      {/* API Key Card - Premium Redesign */}
      <div style={{
        position: "relative",
        padding: 32, borderRadius: 20, marginBottom: 32,
        background: `linear-gradient(145deg, ${colors.cardBg}, ${colors.bg})`,
        border: `1px solid ${colors.border}`,
        boxShadow: `0 8px 32px ${colors.accent}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
        overflow: "hidden"
      }}>
        {/* Glow effect */}
        <div style={{ position: "absolute", top: -50, right: -50, width: 150, height: 150, background: colors.accent, filter: "blur(80px)", opacity: 0.15, borderRadius: "50%" }} />
        
        <h3 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: "0 0 16px" }}>Clé d'API en direct</h3>
        <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20 }}>
          Utilisez cette clé pour authentifier vos requêtes. Gardez-la secrète.
        </p>
        
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#0a0705", border: `1px solid ${colors.accent}40`,
          borderRadius: 12, padding: "12px 16px",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)"
        }}>
          <code style={{ fontSize: 15, fontFamily: "'JetBrains Mono', monospace", color: colors.accent, letterSpacing: 0.5 }}>
            {apiKey}
          </code>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? "#10b981" : `${colors.accent}20`,
              color: copied ? "#fff" : colors.accent,
              border: copied ? "none" : `1px solid ${colors.accent}40`,
              borderRadius: 8, padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            {copied ? <><Check size={14} /> Copié</> : <><Copy size={14} /> Copier</>}
          </button>
        </div>
        
        <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <a href="https://cal.com/docs/api-reference/v2/introduction" target="_blank" style={{
            fontSize: 14, color: colors.text, textDecoration: "none", fontWeight: 600,
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8, background: `${colors.border}`,
            transition: "background 0.2s"
          }}>
            <ExternalLink size={16} /> Documentation API
          </a>
        </div>
      </div>

      {/* Telegram Bot Integration */}
      <div style={{
        padding: 24, borderRadius: 20, marginBottom: 32,
        background: `linear-gradient(145deg, ${colors.cardBg}, ${colors.bg})`,
        border: `1px solid ${colors.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: "#2AABEE",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 20
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>Intégration Telegram</h3>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "2px 0 0" }}>Recevez vos alertes de réservation en temps réel.</p>
          </div>
        </div>

        <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
          Connectez le bot Telegram <strong>@PlanxoBot</strong> à votre compte pour recevoir une notification push immédiate chaque fois qu'un client réserve un rendez-vous avec vous.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={{
            background: "#2AABEE", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 12px rgba(42, 171, 238, 0.25)"
          }}>
            Connecter Telegram
          </button>
          <span style={{ fontSize: 13, color: colors.textMuted }}>
            Non connecté
          </span>
        </div>
      </div>

      {/* Event Types References */}
      <h3 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: "0 0 16px" }}>Identifiants de Types d'Évènements</h3>
      <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>Utilisez ces slugs lors de la création de réservations via l'API.</p>
      
      <div style={{ padding: 8, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.cardBg }}>
        {eventTypes.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: colors.textMuted, fontSize: 14 }}>Aucun type de rendez-vous.</div>
        ) : (
          eventTypes.map((et: any, idx: number) => (
            <div key={et.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 20px",
              borderBottom: idx === eventTypes.length - 1 ? "none" : `1px solid ${colors.border}`,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 4 }}>{et.title}</div>
                <code style={{ fontSize: 13, color: colors.accent, background: `${colors.accent}15`, padding: "2px 6px", borderRadius: 4 }}>
                  {et.slug}
                </code>
              </div>
              <a href={username ? `/${username}/${et.slug}` : `/${et.slug}`} target="_blank" style={{ fontSize: 13, color: colors.textMuted, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                Voir <ExternalLink size={14} />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AppearanceSection({ colors }: any) {
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 6, color: colors.text }}>Apparence</h1>
      <p style={{ fontSize: 14, color: colors.textMuted, marginBottom: 28 }}>Personnalisez l'apparence de votre page de réservation.</p>
      
      <div style={{ padding: 24, borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.cardBg }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, display: "block", marginBottom: 12 }}>Couleur d'accentuation</label>
        <div style={{ display: "flex", gap: 12 }}>
          {[colors.accent, "#3b82f6", "#10b981", "#ef4444", "#8b5cf6"].map((c, i) => (
            <div key={c} style={{
              width: 36, height: 36, borderRadius: "50%", background: c,
              cursor: "pointer", border: i === 0 ? `2px solid ${colors.text}` : "2px solid transparent",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)"
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}
