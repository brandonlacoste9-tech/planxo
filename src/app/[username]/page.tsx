import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function UserHubPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const { data: user } = await supabase
    .from("users")
    .select("id, name, username, avatarUrl, bio")
    .eq("username", username)
    .single();

  if (!user) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter',sans-serif", background: "#1a1208", position: "relative", zIndex: 1,
      }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: "'Cal Sans',sans-serif", fontSize: 32, marginBottom: 8, color: "#c8a96e" }}>
            Utilisateur introuvable
          </h1>
          <p style={{ color: "#a08060", marginBottom: 16 }}>Ce profil n&apos;existe pas.</p>
          <a href="/" style={{ color: "#c8a96e", fontWeight: 600 }}>Retour à l&apos;accueil</a>
        </div>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("EventType")
    .select("id, title, slug, description, length, location, price, color")
    .eq("userId", user.id)
    .eq("isActive", true)
    .eq("isPrivate", false)
    .order("position", { ascending: true });

  const displayName = user.name || user.username || "?";
  const avatarLetter = displayName[0]?.toUpperCase() || "?";

  function locIcon(loc: string) {
    if (loc === "google-meet" || loc === "integrations:google:meet") return { icon: "📹", label: "Google Meet" };
    if (loc === "zoom") return { icon: "📹", label: "Zoom" };
    if (loc === "phone") return { icon: "📞", label: "Téléphone" };
    return { icon: "📍", label: "En personne" };
  }

  return (
    <div style={{
      minHeight: "100vh", fontFamily: "'Inter',sans-serif",
      background: "#1a1208", position: "relative", zIndex: 1,
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(200,169,110,0.15)",
        padding: "48px 24px 40px", textAlign: "center",
      }}>
        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg, #c8a96e, #a07840)",
          color: "#1a1208", display: "inline-flex", alignItems: "center",
          justifyContent: "center", fontSize: 32, fontWeight: 800,
          marginBottom: 16, boxShadow: "0 0 0 4px rgba(200,169,110,0.2)",
          fontFamily: "'Cal Sans','Inter',sans-serif",
        }}>
          {avatarLetter}
        </div>

        {/* Name */}
        <h1 style={{
          fontFamily: "'Cal Sans','Inter',sans-serif", fontSize: 28, fontWeight: 700,
          color: "#f5ead8", margin: "0 0 6px",
        }}>
          {displayName}
        </h1>

        {/* Username pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(200,169,110,0.12)", border: "1px solid rgba(200,169,110,0.25)",
          borderRadius: 20, padding: "4px 14px", marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: "#c8a96e", fontWeight: 500 }}>
            planxo.ca/{user.username}
          </span>
        </div>

        {/* Bio */}
        {user.bio && (
          <p style={{ fontSize: 14, color: "#a08060", maxWidth: 480, margin: "8px auto 0", lineHeight: 1.6 }}>
            {user.bio}
          </p>
        )}
      </div>

      {/* Event type grid */}
      <div style={{ flex: 1, maxWidth: 680, width: "100%", margin: "0 auto", padding: "40px 20px 32px" }}>
        <h2 style={{
          fontFamily: "'Cal Sans','Inter',sans-serif", fontSize: 22, fontWeight: 700,
          color: "#f5ead8", marginBottom: 4,
        }}>
          Disponibilités de {displayName}
        </h2>
        <p style={{
          fontSize: 14, color: "#a08060", marginBottom: 24,
        }}>
          Sélectionnez un type de rendez-vous pour voir les créneaux disponibles
        </p>

        {(!events || events.length === 0) ? (
          /* Empty state */
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(200,169,110,0.12)",
            borderRadius: 16, padding: "48px 24px", textAlign: "center",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ color: "#a08060", fontSize: 15, margin: 0 }}>
              Aucun type de rendez-vous disponible pour le moment.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(events as any[]).map((et) => {
              const { icon, label } = locIcon(et.location);
              return (
                <div
                  key={et.id}
                  style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(200,169,110,0.15)",
                    borderRadius: 16, padding: "22px 24px",
                    transition: "all .15s",
                  }}
                >
                  {/* Top row: color dot + title + price */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: et.color || "#c8a96e", display: "inline-block", flexShrink: 0, marginTop: 3,
                      }} />
                      <h3 style={{
                        fontFamily: "'Cal Sans','Inter',sans-serif", fontSize: 17, fontWeight: 700,
                        color: "#f5ead8", margin: 0, lineHeight: 1.3,
                      }}>
                        {et.title}
                      </h3>
                    </div>
                    {et.price > 0 && (
                      <span style={{
                        background: "rgba(200,169,110,0.15)", border: "1px solid rgba(200,169,110,0.3)",
                        color: "#c8a96e", fontSize: 13, fontWeight: 700,
                        borderRadius: 8, padding: "3px 10px", whiteSpace: "nowrap", marginLeft: 12,
                      }}>
                        {(et.price / 100).toFixed(0)} $
                      </span>
                    )}
                  </div>

                  {/* Chips row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: et.description ? 10 : 16, flexWrap: "wrap" }}>
                    <span style={{
                      background: "rgba(200,169,110,0.1)", border: "1px solid rgba(200,169,110,0.2)",
                      color: "#a08060", fontSize: 12, fontWeight: 600,
                      borderRadius: 6, padding: "2px 9px",
                    }}>
                      🕐 {et.length} min
                    </span>
                    <span style={{
                      background: "rgba(200,169,110,0.1)", border: "1px solid rgba(200,169,110,0.2)",
                      color: "#a08060", fontSize: 12, fontWeight: 500,
                      borderRadius: 6, padding: "2px 9px",
                    }}>
                      {icon} {label}
                    </span>
                  </div>

                  {/* Description */}
                  {et.description && (
                    <p style={{
                      fontSize: 13, color: "#80604a", lineHeight: 1.55, margin: "0 0 16px",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    } as React.CSSProperties}>
                      {et.description}
                    </p>
                  )}

                  {/* CTA */}
                  <Link
                    href={`/${username}/${et.slug}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: "linear-gradient(135deg, #c8a96e, #a07840)",
                      color: "#1a1208", fontWeight: 700, fontSize: 14,
                      borderRadius: 10, padding: "10px 22px",
                      textDecoration: "none", transition: "opacity .15s",
                    }}
                  >
                    Réserver →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid rgba(200,169,110,0.1)",
        padding: "18px 24px", textAlign: "center",
      }}>
        <a
          href="https://planxo.ca"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, color: "#604830", textDecoration: "none", fontWeight: 500 }}
        >
          Propulsé par{" "}
          <span style={{ color: "#c8a96e", fontWeight: 700 }}>Planxo</span>
        </a>
      </div>
    </div>
  );
}
