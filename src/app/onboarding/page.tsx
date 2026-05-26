"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const TIMEZONES = [
  "America/Toronto", "America/New_York", "America/Vancouver",
  "America/Chicago", "America/Edmonton", "America/Halifax",
  "America/Winnipeg", "Europe/Paris", "Europe/London",
];

// ── Progress Indicator ────────────────────────────────────────────────────────
function ProgressIndicator({ step }: { step: number }) {
  const steps = [
    { num: 1, label: "Profil" },
    { num: 2, label: "Disponibilités" },
    { num: 3, label: "Prêt !" },
  ];

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 0, marginBottom: 36,
    }}>
      {steps.map((s, i) => {
        const isActive = s.num === step;
        const isDone = s.num < step;
        return (
          <div key={s.num} style={{ display: "flex", alignItems: "center" }}>
            {/* Step node */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: isDone
                  ? "#c8a96e"
                  : isActive
                    ? "linear-gradient(135deg, #c8a96e, #a07840)"
                    : "rgba(200,169,110,0.1)",
                border: isActive || isDone
                  ? "2px solid #c8a96e"
                  : "2px solid rgba(200,169,110,0.2)",
                color: isDone || isActive ? "#1a1208" : "#604830",
                transition: "all .3s",
                boxShadow: isActive ? "0 0 0 4px rgba(200,169,110,0.15)" : "none",
              }}>
                {isDone ? "✓" : s.num}
              </div>
              <span style={{
                fontSize: 11, fontWeight: isActive ? 700 : 500,
                color: isActive ? "#c8a96e" : isDone ? "#a07840" : "#604830",
                whiteSpace: "nowrap",
              }}>
                {s.label}
              </span>
            </div>

            {/* Connector line (not after last) */}
            {i < steps.length - 1 && (
              <div style={{
                width: 48, height: 2,
                background: s.num < step
                  ? "linear-gradient(90deg, #c8a96e, rgba(200,169,110,0.4))"
                  : "rgba(200,169,110,0.15)",
                marginBottom: 18, flexShrink: 0,
                transition: "background .3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [timeZone, setTimeZone] = useState("America/Toronto");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleFinish() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Session expirée. Reconnectez-vous.");
      setLoading(false);
      return;
    }

    // Upsert user record + seed schedule, availability, event types
    const res = await fetch("/api/v2/onboarding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, timeZone }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Erreur lors de la sauvegarde.");
      setLoading(false);
      return;
    }

    // Show "Prêt !" (step 3) briefly before redirecting
    setStep(3);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 900);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#1a1208", fontFamily: "'Inter', system-ui, sans-serif",
      position: "relative", zIndex: 1,
    }}>
      {/* Language Toggle Badge */}
      <div style={{
        position: "absolute", top: 24, right: 24,
        background: "rgba(200,169,110,0.1)", border: "1px solid rgba(200,169,110,0.2)",
        color: "#c8a96e", fontSize: 12, fontWeight: 700, padding: "6px 10px",
        borderRadius: 8, cursor: "pointer", letterSpacing: 0.5
      }}>
        EN
      </div>

      <div style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "48px 40px",
        width: "100%", maxWidth: 480,
        border: "1px solid rgba(200,169,110,0.18)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
      }}>
        {/* 3-step progress indicator */}
        <ProgressIndicator step={step} />

        {/* ── Step 1: Profil ── */}
        {step === 1 && (
          <>
            <h1 style={{
              fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 26, fontWeight: 700,
              color: "#f5ead8", marginBottom: 8,
            }}>
              Bienvenue sur Planxo
            </h1>
            <p style={{ fontSize: 14, color: "#a08060", marginBottom: 28 }}>
              Configurons votre profil — 2 étapes rapides.
            </p>

            <label style={labelStyle}>Votre nom</label>
            <input
              style={inputStyle}
              placeholder="Jean Tremblay"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />

            <label style={labelStyle}>Nom d&apos;utilisateur</label>
            <input
              style={inputStyle}
              placeholder="jeantremblay"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
            <p style={{ fontSize: 12, color: "#604830", marginTop: -4, marginBottom: 16 }}>
              Votre lien de réservation :{" "}
              <strong style={{ color: "#c8a96e" }}>planxo.ca/{username || "…"}</strong>
            </p>

            <button
              onClick={() => { if (name && username) setStep(2); }}
              disabled={!name || !username}
              style={{
                width: "100%", padding: "14px", borderRadius: 10, border: "none",
                background: !name || !username
                  ? "rgba(200,169,110,0.15)"
                  : "linear-gradient(135deg, #c8a96e, #a07840)",
                color: !name || !username ? "#604830" : "#1a1208",
                fontSize: 15, fontWeight: 700,
                cursor: !name || !username ? "default" : "pointer",
                fontFamily: "'Inter', sans-serif", transition: "all .15s",
              }}
            >
              Continuer →
            </button>
          </>
        )}

        {/* ── Step 2: Disponibilités ── */}
        {step === 2 && (
          <>
            <h1 style={{
              fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 26, fontWeight: 700,
              color: "#f5ead8", marginBottom: 8,
            }}>
              Fuseau horaire
            </h1>
            <p style={{ fontSize: 14, color: "#a08060", marginBottom: 28 }}>
              Choisissez votre fuseau horaire. Vos disponibilités seront Lun–Ven, 9h–17h par défaut.
            </p>

            <label style={labelStyle}>Fuseau horaire</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={timeZone}
              onChange={e => setTimeZone(e.target.value)}
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>
                  {tz.replace("_", " ").split("/").pop()}
                </option>
              ))}
            </select>

            {error && (
              <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: "14px", borderRadius: 10,
                  border: "1px solid rgba(200,169,110,0.25)",
                  background: "transparent", fontSize: 15, fontWeight: 600,
                  cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  color: "#a08060",
                }}
              >
                Retour
              </button>
              <button
                onClick={handleFinish}
                disabled={loading}
                style={{
                  flex: 2, padding: "14px", borderRadius: 10, border: "none",
                  background: loading
                    ? "rgba(200,169,110,0.15)"
                    : "linear-gradient(135deg, #c8a96e, #a07840)",
                  color: loading ? "#604830" : "#1a1208",
                  fontSize: 15, fontWeight: 700,
                  cursor: loading ? "default" : "pointer",
                  fontFamily: "'Inter', sans-serif", transition: "all .15s",
                }}
              >
                {loading ? "Configuration en cours…" : "Commencer →"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Prêt ! (transition screen) ── */}
        {step === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h1 style={{
              fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 26, fontWeight: 700,
              color: "#c8a96e", marginBottom: 8,
            }}>
              Tout est prêt !
            </h1>
            <p style={{ fontSize: 14, color: "#a08060" }}>
              Votre compte est configuré. Redirection vers votre tableau de bord…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600,
  color: "#c8a96e", marginBottom: 6, marginTop: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10,
  border: "1px solid rgba(200,169,110,0.25)", fontSize: 15,
  fontFamily: "'Inter', sans-serif", outline: "none", marginBottom: 8,
  transition: "border-color .15s",
  background: "rgba(255,255,255,0.04)", color: "#f5ead8",
};
