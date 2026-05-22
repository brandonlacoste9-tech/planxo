"use client";
import { useState, useEffect } from "react";

interface CalStatus {
  connected: { google: boolean; outlook: boolean };
  credentials: { type: string; expiresAt: string; connectedAt: string }[];
}

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [eventTypes, setEventTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calStatus, setCalStatus] = useState<CalStatus | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    fetch("/api/v2/me")
      .then(r => r.json())
      .then(data => { setUser(data); setEventTypes(data.eventTypes || []); })
      .finally(() => setLoading(false));

    fetch("/api/auth/status")
      .then(r => r.json())
      .then(d => setCalStatus(d.data))
      .catch(() => {});

    // Check for connection status from OAuth redirect
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("connected") === "google") setStatusMsg("✅ Google Calendar connecté avec succès!");
    if (sp.get("connected") === "outlook") setStatusMsg("✅ Outlook Calendar connecté avec succès!");
    if (sp.get("disconnected")) setStatusMsg("Calendrier déconnecté.");
  }, []);

  if (loading) return <div className="sp"><p style={s.muted}>Chargement...</p></div>;

  const googleConnected = calStatus?.connected?.google || false;
  const outlookConnected = calStatus?.connected?.outlook || false;

  return (
    <div className="sp">
      <style href="settings">{`
        .sp { font-family:'Inter',system-ui,sans-serif; color:#242424; max-width:760px; margin:0 auto; padding:32px 24px 80px; background:#fff; min-height:100vh; }
        .sp-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:40px; }
        .sp-brand { font-family:'Cal Sans','Inter',sans-serif; font-size:22px; font-weight:700; color:#242424; text-decoration:none; letter-spacing:-0.5px; }
        .sp-nav { display:flex; align-items:center; gap:4px; position:relative; }
        .sp-nav-btn { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:8px; border:1px solid rgba(0,0,0,0.08); background:#fff; font-size:14px; font-weight:500; color:#242424; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; }
        .sp-nav-btn:hover { background:#f9fafb; border-color:rgba(0,0,0,0.15); }
        .sp-nav-arrow { font-size:10px; margin-left:2px; color:#898989; }
        .sp-dropdown { position:absolute; top:100%; right:0; margin-top:6px; background:#fff; border:1px solid rgba(0,0,0,0.1); border-radius:12px; padding:6px; box-shadow:0 4px 20px rgba(0,0,0,0.08); z-index:100; min-width:200px; }
        .sp-drop-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; border:none; background:none; width:100%; cursor:pointer; font-size:14px; font-weight:500; color:#242424; font-family:'Inter',sans-serif; text-decoration:none; text-align:left; transition:background 0.1s; }
        .sp-drop-item:hover { background:#f3f4f6; }
        .sp-drop-icon { font-size:16px; width:22px; text-align:center; }
        .sp-card { margin-bottom:24px; padding:28px; border-radius:14px; border:1px solid rgba(0,0,0,0.06); background:#fff; }
        .sp-h2 { font-family:'Cal Sans',sans-serif; font-size:18px; font-weight:700; margin:0 0 16px; }
        .sp-label { font-size:12px; font-weight:500; color:#898989; display:block; margin-bottom:4px; }
        .sp-input { width:100%; padding:10px 14px; border-radius:8px; border:1px solid rgba(0,0,0,0.1); font-size:14px; font-family:'Inter',sans-serif; outline:none; box-sizing:border-box; background:#fff; transition:border-color 0.15s; }
        .sp-input:focus { border-color:#242424; }
        select.sp-input { cursor:pointer; }
        .sp-cal-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:9999px; font-size:14px; font-weight:600; text-decoration:none; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.12s; }
        .sp-cal-btn:hover { transform:translateY(-1px); box-shadow:0 2px 8px rgba(0,0,0,0.08); }
        .sp-cal-status { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:9999px; font-size:13px; font-weight:600; }
        .sp-status-connected { background:#ecfdf5; color:#059669; }
        .sp-status-disconnected { background:#f9fafb; color:#898989; }
        .sp-banner { padding:10px 16px; border-radius:10px; font-size:13px; font-weight:500; margin-bottom:20px; }
        .sp-banner-success { background:#ecfdf5; color:#059669; border:1px solid #d1fae5; }
        .sp-banner-warn { background:#fef3c7; color:#92400e; border:1px solid #fde68a; }
        .sp-et-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid rgba(0,0,0,0.04); }
        .sp-link { font-size:13px; color:#0099ff; text-decoration:none; }
        .sp-link:hover { text-decoration:underline; }
      `}</style>

      {/* ── Header with dropdown nav ── */}
      <div className="sp-header">
        <div>
          <a href="/" className="sp-brand">Planxo</a>
          <div style={s.muted}>Paramètres</div>
        </div>
        <div className="sp-nav">
          <button className="sp-nav-btn" onClick={() => setMenuOpen(!menuOpen)} onBlur={() => setTimeout(() => setMenuOpen(false), 150)}>
            Menu <span className="sp-nav-arrow">{menuOpen ? "▲" : "▼"}</span>
          </button>
          {menuOpen && (
            <div className="sp-dropdown">
              <a href="/dashboard" className="sp-drop-item"><span className="sp-drop-icon">📊</span> Tableau de bord</a>
              <a href="/settings" className="sp-drop-item"><span className="sp-drop-icon">⚙️</span> Paramètres</a>
              <div style={{height:1,background:"rgba(0,0,0,0.06)",margin:"4px 0"}} />
              <a href="/appel-15min" className="sp-drop-item"><span className="sp-drop-icon">📅</span> Appel 15 min</a>
              <a href="/consultation-30min" className="sp-drop-item"><span className="sp-drop-icon">📅</span> Consultation 30 min</a>
              <a href="/reunion-1h" className="sp-drop-item"><span className="sp-drop-icon">📅</span> Réunion 1h</a>
              <div style={{height:1,background:"rgba(0,0,0,0.06)",margin:"4px 0"}} />
              <a href="/api/v2/me" className="sp-drop-item"><span className="sp-drop-icon">🔑</span> API</a>
              <a href="/" className="sp-drop-item"><span className="sp-drop-icon">🏠</span> Accueil</a>
            </div>
          )}
        </div>
      </div>

      {statusMsg && <div className="sp-banner sp-banner-success">{statusMsg}</div>}

      {/* ── Profile ── */}
      <section className="sp-card">
        <h2 className="sp-h2">👤 Profil</h2>
        <div style={{display:"grid",gap:12}}>
          <div><label className="sp-label">Nom</label><input defaultValue={user?.name} className="sp-input" /></div>
          <div><label className="sp-label">Nom d'utilisateur</label><input defaultValue={user?.username} className="sp-input" /></div>
          <div><label className="sp-label">Courriel</label><input defaultValue={user?.email} className="sp-input" /></div>
          <div><label className="sp-label">Fuseau horaire</label>
            <select defaultValue={user?.timeZone || "America/Toronto"} className="sp-input">
              <option>America/Toronto</option><option>America/New_York</option><option>America/Vancouver</option>
              <option>America/Chicago</option><option>Europe/Paris</option><option>Europe/London</option>
              <option>Asia/Tokyo</option><option>Australia/Sydney</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Calendars ── */}
      <section className="sp-card">
        <h2 className="sp-h2">📅 Calendriers connectés</h2>
        <p style={{fontSize:14,color:"#898989",marginBottom:16,lineHeight:1.5}}>
          Connectez Google Calendar ou Outlook pour synchroniser vos disponibilités en temps réel. Les créneaux occupés seront automatiquement exclus.
        </p>

        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
          {googleConnected ? (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span className="sp-cal-status sp-status-connected">🔵 Google Calendar — Connecté</span>
              <a href="/api/auth/google?action=disconnect" className="sp-link" style={{fontSize:12}}>Déconnecter</a>
            </div>
          ) : (
            <a href="/api/auth/google" className="sp-cal-btn" style={{background:"#fff",color:"#242424",border:"1px solid rgba(0,0,0,0.12)"}}>
              🔵 Connecter Google Calendar
            </a>
          )}

          {outlookConnected ? (
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span className="sp-cal-status sp-status-connected">🔷 Outlook — Connecté</span>
              <a href="/api/auth/outlook?action=disconnect" className="sp-link" style={{fontSize:12}}>Déconnecter</a>
            </div>
          ) : (
            <a href="/api/auth/outlook" className="sp-cal-btn" style={{background:"#0078D4",color:"#fff",border:"none"}}>
              🔷 Connecter Outlook
            </a>
          )}
        </div>

        {(!googleConnected && !outlookConnected) && (
          <div className="sp-banner sp-banner-warn">
            ⚠️ Pour activer la synchronisation, ajoutez GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (et OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET pour Outlook) dans les variables d'environnement Vercel, puis configurez les URI de redirection dans Google Cloud Console.
          </div>
        )}
      </section>

      {/* ── Event Types ── */}
      <section className="sp-card">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 className="sp-h2" style={{marginBottom:0}}>📋 Types de rendez-vous</h2>
          <a href="/dashboard" style={{fontSize:13,color:"#242424",fontWeight:500,textDecoration:"none",padding:"6px 14px",borderRadius:9999,border:"1px solid rgba(0,0,0,0.1)"}}>Gérer</a>
        </div>
        {eventTypes.map((et: any) => (
          <div key={et.id} className="sp-et-row">
            <div>
              <div style={{fontSize:14,fontWeight:600}}>{et.title}</div>
              <div style={{fontSize:12,color:"#898989"}}>{et.length} min · {et.location} · /{et.slug}</div>
            </div>
            <a href={`/${et.slug}`} className="sp-link">Lien →</a>
          </div>
        ))}
      </section>

      {/* ── API ── */}
      <section className="sp-card">
        <h2 className="sp-h2">🔑 API</h2>
        <p style={{fontSize:14,color:"#898989",marginBottom:12,lineHeight:1.5}}>API v2 compatible Cal.com. Utilisez l'en-tête <code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:4,fontSize:13}}>Authorization: Bearer</code>.</p>
        <code style={{display:"block",background:"#f9fafb",padding:12,borderRadius:8,fontSize:12,fontFamily:"monospace",marginBottom:12}}>
          curl https://rdv-qc.vercel.app/api/v2/me
        </code>
        <a href="https://cal.com/docs/api-reference/v2/introduction" target="_blank" className="sp-link">Documentation API →</a>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  muted: { fontSize:13, color:"#898989", marginTop:4 },
};
