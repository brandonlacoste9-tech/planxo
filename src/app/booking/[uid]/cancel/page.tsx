"use client";

import { useState, useEffect, use } from "react";

interface Booking {
  id: string;
  uid: string;
  title: string;
  start: string;
  end: string;
  status: string;
  attendees: { name: string; email: string }[];
}

export default function CancelPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = use(params);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/v2/bookings?uid=${uid}`)
      .then(r => r.json())
      .then(data => {
        const b = data?.data?.[0];
        if (!b) { setError("Réservation introuvable."); }
        else setBooking(b);
      })
      .catch(() => setError("Erreur de chargement."))
      .finally(() => setLoading(false));
  }, [uid]);

  async function handleCancel() {
    if (!booking) return;
    setCancelling(true);
    setError("");
    const res = await fetch(`/api/v2/bookings/${booking.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Annulé par le participant" }),
    });
    setCancelling(false);
    if (res.ok) {
      setDone(true);
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json?.error?.message || "Erreur lors de l'annulation.");
    }
  }

  const cardStyle: React.CSSProperties = {
    background: "#221608",
    border: "1px solid rgba(200,169,110,0.15)",
    borderRadius: 14,
    padding: "24px 28px",
    marginBottom: 24,
    textAlign: "left" as const,
  };

  if (loading) return (
    <div style={pageStyle}>
      <p style={{ color: "#c8a96e" }}>Chargement...</p>
    </div>
  );

  if (done) return (
    <div style={{ ...pageStyle, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: "#c8a96e", fontFamily: "'Cal Sans',sans-serif", fontSize: 24, marginBottom: 8 }}>Rendez-vous annulé</h2>
      <p style={{ color: "#8a7a60", fontSize: 15 }}>Votre rendez-vous a été annulé avec succès.</p>
    </div>
  );

  return (
    <div style={pageStyle}>
      <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 26, fontWeight: 700, color: "#c8a96e", marginBottom: 8 }}>
        Annuler le rendez-vous
      </h1>
      <p style={{ color: "#8a7a60", fontSize: 14, marginBottom: 28 }}>
        Confirmez l&apos;annulation de votre réservation ci-dessous.
      </p>

      {(error && !booking) && (
        <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 16 }}>{error}</p>
      )}

      {booking && (
        <>
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: "#8a7a60", marginBottom: 6, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Détails du rendez-vous
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#e8d5aa", marginBottom: 10 }}>
              {booking.title || "Rendez-vous"}
            </div>
            <div style={{ fontSize: 14, color: "#c8a96e", marginBottom: 4 }}>
              📅 {new Date(booking.start).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <div style={{ fontSize: 14, color: "#c8a96e", marginBottom: 4 }}>
              🕐 {new Date(booking.start).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} — {new Date(booking.end).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
            </div>
            {booking.attendees?.[0]?.name && (
              <div style={{ fontSize: 13, color: "#8a7a60", marginTop: 8 }}>
                👤 {booking.attendees[0].name}
              </div>
            )}
            <div style={{ marginTop: 10, display: "inline-block", padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 600, background: booking.status === "cancelled" ? "rgba(239,68,68,0.12)" : "rgba(200,169,110,0.12)", color: booking.status === "cancelled" ? "#ef4444" : "#c8a96e" }}>
              {booking.status === "cancelled" ? "Annulé" : booking.status === "accepted" ? "Confirmé" : "En attente"}
            </div>
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>{error}</p>}

          {booking.status === "cancelled" ? (
            <p style={{ color: "#8a7a60", fontSize: 14 }}>Ce rendez-vous est déjà annulé.</p>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  padding: "12px 28px", borderRadius: 9, border: "none",
                  background: "#c8a96e", color: "#1a1208", fontSize: 14, fontWeight: 700,
                  cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.7 : 1,
                  fontFamily: "'Inter',sans-serif",
                }}
              >
                {cancelling ? "Annulation..." : "Confirmer l'annulation"}
              </button>
              <a
                href="/"
                style={{
                  padding: "12px 22px", borderRadius: 9,
                  border: "1px solid rgba(200,169,110,0.25)",
                  color: "#c8a96e", fontSize: 14, fontWeight: 600,
                  textDecoration: "none", display: "inline-block",
                }}
              >
                Retour
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#1a1208",
  padding: "60px 24px",
  maxWidth: 520,
  margin: "0 auto",
  fontFamily: "'Inter',sans-serif",
  color: "#e8d5aa",
};
