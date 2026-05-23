"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function SignUpWithGoogle() {
  const supabase = createClient();
  return (
    <button
      onClick={() => supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
      })}
      style={{ background: "var(--btn-bg, #242424)", color: "var(--btn-text, #fff)", padding: "14px 28px", borderRadius: 9999, fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, transition: "all .15s", fontFamily: "'Inter', sans-serif" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      S'inscrire avec Google
    </button>
  );
}

export default function HomePage() {
  const [pricingAnnual, setPricingAnnual] = useState(false);
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const toggleLang = () => setLang(l => l === "fr" ? "en" : "fr");
  const [dark, setDark] = useState(false);
  const toggleDark = () => setDark(d => !d);

  // Cognac dark theme colors
  const c = dark ? {
    bg: "#1a1008", bg2: "#241810", text: "#e8d5c4", textMuted: "#a0896e",
    accent: "#c47f3a", accentHover: "#d4944e", accentText: "#1a1008",
    border: "rgba(196,127,58,0.12)", cardBg: "#241810",
    navBg: "rgba(26,16,8,0.95)", ctaBg: "#c47f3a", ctaText: "#1a1008",
    btnBg: "#c47f3a", btnText: "#1a1008", btnBorder: "rgba(196,127,58,0.25)",
    gold: "#d4a853", goldDim: "rgba(212,168,83,0.15)", goldText: "#f0c060",
    sectionBg: "#1e140c", cardBorder: "rgba(196,127,58,0.1)",
    success: "#c47f3a", availDot: "#d4a853", dimText: "#6b5040",
    popularBg: "#c47f3a", popularText: "#1a1008",
  } : {
    bg: "#ffffff", bg2: "#f9fafb", text: "#242424", textMuted: "#898989",
    accent: "#242424", accentHover: "#1a1a1a", accentText: "#ffffff",
    border: "rgba(0,0,0,0.06)", cardBg: "#ffffff",
    navBg: "rgba(255,255,255,0.92)", ctaBg: "#242424", ctaText: "#ffffff",
    btnBg: "#242424", btnText: "#ffffff", btnBorder: "rgba(0,0,0,0.12)",
    gold: "#d4a853", goldDim: "rgba(212,168,83,0.15)", goldText: "#b8941e",
    sectionBg: "#f9fafb", cardBorder: "rgba(0,0,0,0.06)",
    success: "#10b981", availDot: "#10b981", dimText: "#6b7280",
    popularBg: "#242424", popularText: "#ffffff",
  };

  const fr = {
    nav: { solutions: "Solutions", enterprise: "Entreprise", calAi: "Planxo IA", developer: "Développeur", resources: "Ressources", pricing: "Tarifs", signIn: "Connexion", getStarted: "Essayer" },
    banner: "Planxo lance la v1.0",
    hero: { title: "La meilleure façon de planifier vos rendez-vous", subtitle: "Un logiciel de planification entièrement personnalisable pour les professionnels, les entreprises et les développeurs qui créent des plateformes de rendez-vous.", cta1: "S'inscrire avec Google", cta2: "S'inscrire avec courriel", noCard: "Aucune carte de crédit requise" },
    trust: "Utilisé par les entreprises québécoises les plus performantes",
  };
  const en = {
    nav: { solutions: "Solutions", enterprise: "Enterprise", calAi: "Planxo AI", developer: "Developer", resources: "Resources", pricing: "Pricing", signIn: "Sign In", getStarted: "Try it" },
    banner: "Planxo launches v1.0",
    hero: { title: "The best way to schedule your meetings", subtitle: "A fully customizable scheduling software for professionals, businesses, and developers building appointment platforms.", cta1: "Sign up with Google", cta2: "Sign up with email", noCard: "No credit card required" },
    trust: "Trusted by Quebec's top-performing businesses",
  };
  const t = lang === "fr" ? fr : en;
  const benefits = [
    { icon: "∞", title: "Rendez-vous illimités", desc: "Aucune limite sur le nombre de réservations que vous pouvez recevoir.", color: "#3b82f6" },
    { icon: "🔔", title: "Rappels automatiques", desc: "Réduisez les absences avec des rappels par courriel et SMS.", color: "#f59e0b" },
    { icon: "🎨", title: "Personnalisation complète", desc: "Adaptez votre page de réservation à votre image de marque.", color: "#8b5cf6" },
    { icon: "💳", title: "Paiements intégrés", desc: "Acceptez les paiements directement via Stripe avant le rendez-vous.", color: "#10b981" },
    { icon: "🌍", title: "Fuseau horaire intelligent", desc: "Détection automatique du fuseau horaire de vos clients.", color: "#06b6d4" },
    { icon: "👥", title: "Lien d'équipe", desc: "Partagez une page commune pour toute votre équipe.", color: "#ec4899" }
  ];
  const footer = {
    product: { title: "Produit", links: ["Types de rendez-vous", "Disponibilités", "Rappels", "Paiements", "Intégrations"], hrefs: ["/consultation-30min", "/settings", "/dashboard", "/settings", "/settings"] },
    solutions: { title: "Solutions", links: ["Professionnels", "Équipes", "Entreprises", "Développeurs", "API"], hrefs: ["/appel-15min", "/reunion-1h", "/consultation-30min", "/dashboard", "/api/v2/me"] },
    resources: { title: "Ressources", links: ["Documentation", "API Reference", "Status", "Support", "Paramètres"], hrefs: ["/api/v2/me", "https://cal.com/docs/api-reference/v2/introduction", "/dashboard", "mailto:info@planxo.ca", "/settings"] },
    company: { title: "Entreprise", links: ["À propos", "Carrières", "Contact", "Confidentialité", "Conditions"], hrefs: ["/", "/", "mailto:info@planxo.ca", "/", "/"] },
  };
  const trustLogos = ["Desjardins", "Bombardier", "Québecor", "Coveo", "Lightspeed", "SNC-Lavalin"];
  const plans = [
    { name: "Gratuit", price: 0, features: ["1 type de rendez-vous", "1 calendrier", "Lien de réservation", "Rappels courriel"] },
    { name: "Pro", price: 49, features: ["Rendez-vous illimités", "6 calendriers", "Rappels SMS", "Paiements Stripe", "Visio intégrée", "Formulaires personnalisés"], popular: true },
    { name: "Équipe", price: 99, features: ["Tout Pro +", "Pages d'équipe", "Admin centralisé", "Routage intelligent", "Analytique", "Support prioritaire"] },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: c.bg, color: c.text, position: "relative", zIndex: 1, transition: "background .3s, color .3s" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        :root { --btn-bg: ${c.btnBg}; --btn-text: ${c.btnText}; }
        .nav-link:hover { color: ${c.text} !important; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 24px ${dark ? "rgba(196,127,58,0.15)" : "rgba(0,0,0,0.06)"}; }
        .footer-link:hover { color: ${c.text} !important; }
        .hero-widget button:hover { background: ${c.bg2} !important; }
        .gold-highlight { color: ${c.gold} !important; }
        .gold-border { border-color: ${c.gold} !important; }
        @media (max-width: 900px) { .hero-widget { display: none !important; } }
      `}} />

      {/* ── NAV ── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: c.navBg, backdropFilter: "blur(12px)", borderBottom: `1px solid ${c.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: c.text, letterSpacing: "-0.5px" }}>Planxo</span>
            </a>
            <nav style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500 }}>
              {[{ label: t.nav.solutions, href: "#how" }, { label: t.nav.enterprise, href: "#pricing" }, { label: t.nav.calAi, href: "/appel-15min" }, { label: t.nav.developer, href: "/settings" }, { label: t.nav.pricing, href: "#pricing" }].map(l => (
                <a key={l.label} href={l.href} style={{ color: c.textMuted, textDecoration: "none", transition: "color .15s" }} className="nav-link">{l.label}</a>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={toggleDark} style={{ background: "none", border: `1px solid ${c.btnBorder}`, borderRadius: 6, padding: "4px 8px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: c.textMuted, fontFamily: "'Inter', sans-serif", }}>{dark ? "☀️" : "🌙"}</button>
            <button onClick={toggleLang} style={{ background: "none", border: `1px solid ${c.btnBorder}`, borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: c.textMuted, fontFamily: "'Inter', sans-serif", }}>{lang === "fr" ? "EN" : "FR"}</button>
            <a href="/login" style={{ color: c.textMuted, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{t.nav.signIn}</a>
            <a href="/login?mode=register" style={{ background: c.btnBg, color: c.btnText, padding: "8px 20px", borderRadius: 9999, fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .15s" }}>{t.nav.getStarted}</a>
          </div>
        </div>
      </header>

      {/* ── BANNER ── */}
      <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, color: c.textMuted, borderBottom: `1px solid ${c.border}` }}>
        <a href="/consultation-30min" style={{ color: c.accent, textDecoration: "underline" }}>{t.banner}</a>
      </div>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 60px", display: "flex", gap: 60, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 56, fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.5px", color: c.text, marginBottom: 20 }}>{t.hero.title}</h1>
          <p style={{ fontSize: 18, color: c.textMuted, lineHeight: 1.6, marginBottom: 32, fontWeight: 400 }}>{t.hero.subtitle}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <SignUpWithGoogle />
            <a href="/login?mode=register" style={{ border: `1px solid ${c.btnBorder}`, color: c.text, padding: "14px 28px", borderRadius: 9999, fontSize: 15, fontWeight: 600, textDecoration: "none", background: c.cardBg, transition: "all .15s" }}>{t.hero.cta2}</a>
          </div>
          <p style={{ fontSize: 13, color: c.textMuted, marginTop: 8 }}>{t.hero.noCard}</p>
        </div>
        {/* Calendar widget mockup */}
        <div style={{ flex: "0 0 400px" }} className="hero-widget">
          <div style={{ background: c.cardBg, borderRadius: 24, padding: 28, border: `1px solid ${c.cardBorder}`, boxShadow: dark ? "0 4px 32px rgba(0,0,0,0.4)" : "0 4px 32px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${c.gold} 0%, ${c.accent} 100%)`, color: c.accentText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>P</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: c.text }}>Planxo</div>
                <div style={{ fontSize: 13, color: c.textMuted }}>Consultation 30 min</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
              {["15m","30m","45m","1h"].map(d => (
                <button key={d} style={{ padding: "7px 14px", borderRadius: 9999, border: d === "30m" ? `2px solid ${c.accent}` : `1px solid ${c.cardBorder}`, background: d === "30m" ? c.bg2 : c.cardBg, fontSize: 13, fontWeight: 500, color: c.text, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>{d}</button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>📹 Google Meet</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
              <span style={{ fontSize: 13, color: c.textMuted }}>🌍 America/Toronto</span>
            </div>
            <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>mai 2025</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ width:28,height:28,borderRadius:7,border:`1px solid ${c.cardBorder}`,background:c.cardBg,cursor:"pointer",fontSize:14,color:c.text }}>‹</button>
                  <button style={{ width:28,height:28,borderRadius:7,border:`1px solid ${c.cardBorder}`,background:c.cardBg,cursor:"pointer",fontSize:14,color:c.text }}>›</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 16 }}>
                {["D","L","M","M","J","V","S"].map(d => <div key={d} style={{ fontSize: 11, color: c.textMuted, textAlign: "center", paddingBottom: 4, fontWeight: 500 }}>{d}</div>)}
                {Array.from({length:35}, (_,i) => {
                  const day = i - 3, active = day === 23 || day === 25 || day === 28 || day === 30, isSelected = day === 25;
                  if (day < 1 || day > 31) return <div key={i} />;
                  return (
                    <button key={i} style={{ padding: "6px 0", borderRadius: 8, border: "none", fontSize: 13, cursor: "pointer", background: isSelected ? c.accent : active ? c.goldDim : c.cardBg, color: isSelected ? c.accentText : day < 23 ? c.dimText : c.text, fontWeight: isSelected ? 600 : 400, fontFamily: "'Inter',sans-serif", position: "relative" }}>
                      {day}{active && !isSelected && <span style={{ position:"absolute",bottom:2,left:"50%",marginLeft:-3,width:6,height:6,borderRadius:"50%",background: c.availDot }} />}
                    </button>
                  );
                })}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: c.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>dimanche 25 mai</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","14:00","14:30","15:00","15:30","16:00","16:30"].map(t => (
                    <button key={t} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${c.cardBorder}`, background: c.cardBg, fontSize: 13, fontWeight: 500, color: c.text, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all .15s" }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section style={{ padding: "40px 24px", borderTop: `1px solid ${c.border}`, borderBottom: `1px solid ${c.border}` }}>
        <p style={{ textAlign: "center", fontSize: 12, color: c.textMuted, marginBottom: 24, fontWeight: 500, textTransform: "uppercase", letterSpacing: 1 }}>{t.trust}</p>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {trustLogos.map(l => <span key={l} style={{ fontSize: 17, fontWeight: 700, color: c.text, opacity: 0.2, letterSpacing: "-0.3px" }}>{l}</span>)}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>Comment ça fonctionne</p>
        <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: c.text, textAlign: "center", marginBottom: 12 }}>La planification simplifiée</h2>
        <p style={{ fontSize: 16, color: c.textMuted, textAlign: "center", maxWidth: 500, margin: "0 auto 56px" }}>Une solution simple pour les travailleurs autonomes, puissante pour les entreprises en croissance.</p>
        <div style={{ display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
          {[{ num: "01", icon: "📅", title: "Connectez votre calendrier", desc: "On s'occupe de tout pour éviter les doubles réservations.", visual: ["L","M","M","J","V","S","D","","","","10","11","12"] }, { num: "02", icon: "⏰", title: "Définissez vos disponibilités", desc: "Bloquez vos week-ends? Ajoutez des pauses? C'est facile.", visual: ["8:30","9:00","9:30","10:00","10:30","11:00","11:30"] }, { num: "03", icon: "📹", title: "Choisissez comment vous rencontrez", desc: "Visio, appel téléphonique ou marche au parc!", visual: ["Google Meet","Zoom","Téléphone"," En personne"] }].map((step, i) => (
            <div key={i} style={{ flex: "1 1 300px", maxWidth: 360, padding: 32, borderRadius: 16, border: `1px solid ${c.cardBorder}`, background: c.cardBg, transition: "all .2s", cursor: "default" }} className="card-hover">
              <div style={{ fontSize: 48, fontWeight: 700, color: c.goldDim, fontFamily: "'Cal Sans', sans-serif", marginBottom: 4 }}>{step.num}</div>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{step.icon}</div>
              <h3 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: c.text, marginBottom: 8 }}>{step.title}</h3>
              <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6, marginBottom: 16 }}>{step.desc}</p>
              <div style={{ background: c.bg2, borderRadius: 10, padding: 14, border: `1px solid ${c.border}` }}>
                {step.visual.map((v, j) => <span key={j} style={{ display: "inline-block", padding: step.num === "02" ? "4px 10px" : "6px 8px", fontSize: 12, color: c.dimText, background: c.cardBg, borderRadius: 6, margin: "0 4px 4px 0", border: `1px solid ${c.border}`, fontFamily: "monospace" }}>{v}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 40, display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="/dashboard" style={{ background: c.btnBg, color: c.btnText, padding: "12px 28px", borderRadius: 9999, fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .15s" }}>Commencer</a>
          <a href="/demo" style={{ border: `1px solid ${c.btnBorder}`, color: c.text, padding: "12px 28px", borderRadius: 9999, fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .15s" }}>Voir une démo</a>
        </div>
      </section>

      {/* ── BENEFITS ── */}
      <section style={{ background: c.sectionBg, padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>Avantages</p>
          <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: c.text, textAlign: "center", marginBottom: 48 }}>Pourquoi choisir Planxo</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {benefits.map((item, i) => (
              <div key={i} style={{ background: c.cardBg, padding: 28, borderRadius: 14, border: `1px solid ${c.cardBorder}`, transition: "all .2s" }} className="card-hover">
                <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14, background: dark ? c.goldDim : `${item.color}12`, border: `1px solid ${dark ? c.goldDim : item.color + "20"}` }}>{item.icon}</div>
                <h3 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 17, fontWeight: 700, color: c.text, marginBottom: 6 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: c.textMuted, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>Témoignages</p>
          <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: c.text, textAlign: "center", marginBottom: 8 }}>Pourquoi nos utilisateurs adorent Planxo</h2>
          <p style={{ fontSize: 16, color: c.textMuted, textAlign: "center", maxWidth: 500, margin: "0 auto 48px" }}>Découvrez l'impact que nous avons eu sur ceux qui comptent le plus — nos clients.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
            {[
              { quote: "Je me demandais si je devais choisir Planxo ou Calendly. Après un appel rapide avec l'équipe, j'ai été conquise. L'interface est fluide et le support est exceptionnel!", author: "Marie V.", handle: "@mariev_entrepreneure", color: dark ? c.gold : "#1d9bf0" },
              { quote: "Planxo est un rêve pour les développeurs. L'API v2 compatible Cal.com rend l'intégration ultra simple. Je l'ai connectée à mon CRM en une heure.", author: "Ahmed E.", handle: "@ahmed_dev_mtl", color: dark ? c.gold : "#da552f" },
              { quote: "Officiellement migré de Calendly à Planxo ⚡️ Mes clients trouvent l'expérience de réservation beaucoup plus fluide.", author: "Jean-Joseph", handle: "@jj_tech_qc", color: dark ? c.gold : "#1d9bf0" },
              { quote: "Incroyable. Je le recommande à tout le monde. Planxo m'aide à créer plus de rendez-vous spontanément, tellement c'est simple comparé aux autres.", author: "Ben L.", handle: "@ben_marketing", color: dark ? c.gold : "#da552f" },
              { quote: "Depuis que je suis passé à Planxo, j'ai réduit mes disponibilités à 2 jours par semaine. Je suis plus productif et j'ai plus de temps pour mes projets. Zéro spam.", author: "Nick B.", handle: "@nickb_consultant", color: dark ? c.gold : "#1d9bf0" },
              { quote: "2 jours avec Planxo m'ont suffi pour ne plus jamais regarder Calendly. Le design épuré et la rapidité de prise en main sont bluffants.", author: "Anuvesh S.", handle: "@anuvesh_fondateur", color: dark ? c.gold : "#1d9bf0" },
              { quote: "Très facile à configurer. Connecté à mon Google Calendar sans aucun problème. L'interface est vraiment soignée et professionnelle.", author: "Pankaj D.", handle: "@pankaj_designer", color: dark ? c.gold : "#da552f" },
              { quote: "J'adore le style minimaliste de Planxo. Exactement ce dont j'avais besoin pour mon entreprise de consultation.", author: "Clément D.", handle: "@clement_mtl", color: dark ? c.gold : "#da552f" },
              { quote: "Aujourd'hui, je suis officiellement un ambassadeur Planxo. Le produit est épique. Où est-ce que je peux acheter du merch??", author: "Farhaj M.", handle: "@farhaj_fan", color: dark ? c.gold : "#1d9bf0" },
              { quote: "Passé à Planxo directement sur le plan Pro pour avoir une URL personnalisée. Le UI et les fonctionnalités sont excellents. Aucun regret.", author: "Ry W.", handle: "@ry_builder", color: dark ? c.gold : "#1d9bf0" },
            ].map((t, i) => (
              <div key={i} style={{ background: c.cardBg, borderRadius: 14, border: `1px solid ${c.cardBorder}`, padding: 24, transition: "all .2s", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="card-hover">
                <div>
                  <div style={{ fontSize: 28, marginBottom: 12, color: t.color, opacity: 0.6 }}>“</div>
                  <p style={{ fontSize: 14, color: c.text, lineHeight: 1.65, marginBottom: 16, fontStyle: "italic" }}>{t.quote}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: `1px solid ${c.border}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: dark ? c.goldDim : `${t.color}15`, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{t.author[0]}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{t.author}</div>
                    <div style={{ fontSize: 12, color: t.color }}>{t.handle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ fontSize: 12, color: c.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>Tarifs</p>
        <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: c.text, textAlign: "center", marginBottom: 8 }}>Des forfaits pour tous</h2>
        <p style={{ fontSize: 16, color: c.textMuted, textAlign: "center", maxWidth: 460, margin: "0 auto 28px" }}>Du gratuit au tout-inclus. Parfait pour les indépendants comme pour les équipes.</p>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 40 }}>
          <span style={{ fontSize: 14, color: pricingAnnual ? c.textMuted : c.text, fontWeight: pricingAnnual ? 400 : 600 }}>Mensuel</span>
          <div onClick={() => setPricingAnnual(!pricingAnnual)} style={{ width: 44, height: 24, borderRadius: 12, background: pricingAnnual ? c.accent : dark ? "#3a2a18" : "#e5e5e5", cursor: "pointer", position: "relative", transition: "background .2s" }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: c.cardBg, position: "absolute", top: 2, left: pricingAnnual ? 22 : 2, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: 14, color: pricingAnnual ? c.text : c.textMuted, fontWeight: pricingAnnual ? 600 : 400 }}>Annuel <span style={{ fontSize: 11, color: c.success, fontWeight: 600 }}>−20%</span></span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, maxWidth: 880, margin: "0 auto" }}>
          {plans.map((plan, i) => {
            const price = pricingAnnual ? Math.round(plan.price * 0.8) : plan.price;
            const isPopular = plan.popular;
            return (
              <div key={i} style={{ background: isPopular ? c.popularBg : c.cardBg, color: isPopular ? c.popularText : c.text, padding: 36, borderRadius: 18, position: "relative", border: isPopular ? "none" : `1px solid ${c.cardBorder}`, transition: "all .2s" }} className="card-hover">
                {isPopular && <span style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: c.popularBg, color: c.popularText, padding: "4px 18px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: `2px solid ${c.cardBg}` }}>Populaire</span>}
                <h3 style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4, color: "inherit" }}>{plan.name}</h3>
                <p style={{ fontSize: 14, color: isPopular ? "rgba(255,255,255,0.6)" : c.textMuted, marginBottom: 20 }}>{i === 0 ? "Pour commencer" : i === 1 ? "Pour les professionnels" : "Pour les équipes"}</p>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: 44, fontWeight: 700, color: "inherit" }}>{price}$</span>
                  <span style={{ fontSize: 14, color: isPopular ? "rgba(255,255,255,0.6)" : c.textMuted }}> /mois</span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, marginBottom: 28 }}>
                  {plan.features.map((f, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, fontSize: 14, color: "inherit", opacity: isPopular ? 0.9 : 0.7 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> {f}
                    </li>
                  ))}
                </ul>
                <a href="/login?mode=register" style={{ display: "block", textAlign: "center", padding: "13px 0", borderRadius: 9999, fontWeight: 600, fontSize: 14, textDecoration: "none", background: isPopular ? c.cardBg : c.btnBg, color: isPopular ? c.text : c.btnText, transition: "all .15s" }}>{i === 0 ? "Commencer gratuitement" : "Essai gratuit"}</a>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: c.ctaBg, padding: "96px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 44, fontWeight: 700, lineHeight: 1.15, color: c.ctaText, marginBottom: 14 }}>Prêt à simplifier vos rendez-vous?</h2>
        <p style={{ fontSize: 16, color: dark ? "rgba(26,16,8,0.6)" : "rgba(255,255,255,0.5)", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>Rejoignez les professionnels québécois qui gagnent du temps chaque semaine.</p>
        <a href="/login?mode=register" style={{ display: "inline-block", background: c.cardBg, color: c.text, padding: "15px 40px", borderRadius: 9999, fontWeight: 600, fontSize: 15, textDecoration: "none", transition: "all .15s" }}>Commencer gratuitement</a>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: c.bg2, padding: "64px 24px 40px", borderTop: `1px solid ${c.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 40 }}>
          <div>
            <div style={{ fontFamily: "'Cal Sans', sans-serif", fontSize: 20, fontWeight: 700, color: c.text, marginBottom: 12 }}>Planxo</div>
            <p style={{ fontSize: 13, color: c.textMuted, lineHeight: 1.6 }}>La plateforme de planification #1 au Québec.</p>
          </div>
          {[footer.product, footer.solutions, footer.resources, footer.company].map((col, i) => (
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.text, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.5 }}>{col.title}</div>
              {col.links.map((l, j) => (
                <a key={l} href={col.hrefs[j]} style={{ display: "block", fontSize: 13, color: c.textMuted, textDecoration: "none", marginBottom: 8, transition: "color .15s" }} className="footer-link">{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1100, margin: "40px auto 0", paddingTop: 24, borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textMuted, flexWrap: "wrap", gap: 12 }}>
          <span>© {new Date().getFullYear()} Planxo. Tous droits réservés.</span>
          <span><a href="mailto:info@planxo.ca" style={{ color: c.textMuted }}>info@planxo.ca</a></span>
        </div>
      </footer>
    </div>
  );
}
