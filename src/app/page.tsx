export default function HomePage() {
  const t = {
    nav: { solutions: "Solutions", enterprise: "Entreprise", calAi: "Planxo IA", developer: "Développeur", resources: "Ressources", pricing: "Tarifs", signIn: "Connexion", getStarted: "Commencer" },
    banner: "Planxo lance la v1.0",
    hero: { title: "La meilleure façon de planifier vos rendez-vous", subtitle: "Un logiciel de planification entièrement personnalisable pour les professionnels, les entreprises et les développeurs qui créent des plateformes de rendez-vous.", google: "S'inscrire avec Google", email: "S'inscrire avec courriel", noCard: "Aucune carte de crédit requise" },
    trust: "Utilisé par les entreprises québécoises les plus performantes",
    how: { label: "Comment ça fonctionne", title: "La planification de rendez-vous simplifiée", subtitle: "Une solution simple pour les travailleurs autonomes, puissante pour les entreprises en croissance.", cta: "Commencer", demo: "Voir une démo", steps: [{ num: "01", title: "Connectez votre calendrier", desc: "On s'occupe de tout pour éviter les doubles réservations." }, { num: "02", title: "Définissez vos disponibilités", desc: "Bloquez vos week-ends? Ajoutez des pauses? C'est facile." }, { num: "03", title: "Choisissez comment vous rencontrez", desc: "Visio, appel téléphonique ou marche au parc!" }] },
    benefits: { label: "Avantages", items: [{ title: "Rendez-vous illimités", desc: "Aucune limite sur le nombre de réservations que vous pouvez recevoir." }, { title: "Rappels automatiques", desc: "Réduisez les absences avec des rappels par courriel et SMS." }, { title: "Personnalisation complète", desc: "Adaptez votre page de réservation à votre image de marque." }, { title: "Paiements intégrés", desc: "Acceptez les paiements directement via Stripe avant le rendez-vous." }, { title: "Fuseau horaire intelligent", desc: "Détection automatique du fuseau horaire de vos clients." }, { title: "Lien d'équipe", desc: "Partagez une page commune pour toute votre équipe." }] },
    pricing: { label: "Tarifs", title: "Des forfaits pour tous", subtitle: "Du gratuit au tout-inclus. Parfait pour les indépendants comme pour les équipes.", plans: [{ name: "Gratuit", price: "0$", desc: "Pour commencer", features: ["1 type de rendez-vous", "1 calendrier", "Lien de réservation", "Rappels courriel"], cta: "Commencer gratuitement" }, { name: "Pro", price: "49$", desc: "Pour les professionnels", features: ["Rendez-vous illimités", "6 calendriers", "Rappels SMS", "Paiements Stripe", "Visio intégrée", "Formulaires personnalisés"], cta: "Essai gratuit", popular: true }, { name: "Équipe", price: "99$", desc: "Pour les équipes", features: ["Tout Pro +", "Pages d'équipe", "Admin centralisé", "Routage intelligent", "Analytique", "Support prioritaire"], cta: "Essai gratuit" }] },
    footer: { rights: "Tous droits réservés.", contact: "info@planxo.ca" }
  };

  const trustLogos = ["Desjardins", "Bombardier", "Québecor", "Coveo", "Lightspeed", "SNC-Lavalin"];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#ffffff", color: "#242424" }}>
      {/* Nav */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <span style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 22, fontWeight: 700, color: "#242424", letterSpacing: "-0.5px" }}>Planxo</span>
            </a>
            <nav style={{ display: "flex", gap: 24, fontSize: 14, fontWeight: 500 }}>
              <span style={{ color: "#898989", cursor: "pointer" }}>{t.nav.solutions}</span>
              <a href="#" style={{ color: "#898989", textDecoration: "none" }}>{t.nav.enterprise}</a>
              <a href="#" style={{ color: "#898989", textDecoration: "none" }}>{t.nav.calAi}</a>
              <span style={{ color: "#898989", cursor: "pointer" }}>{t.nav.developer}</span>
              <a href="#" style={{ color: "#898989", textDecoration: "none" }}>{t.nav.pricing}</a>
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="#" style={{ color: "#898989", textDecoration: "none", fontSize: 14, fontWeight: 500 }}>{t.nav.signIn}</a>
            <a href="/dashboard" style={{ background: "#242424", color: "#fff", padding: "8px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t.nav.getStarted}</a>
          </div>
        </div>
      </header>

      {/* Announcement Banner */}
      <div style={{ textAlign: "center", padding: "10px 0", fontSize: 13, color: "#898989", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <a href="#" style={{ color: "#0099ff", textDecoration: "underline" }}>{t.banner}</a>
      </div>

      {/* Hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.5px", color: "#242424", maxWidth: 800, margin: "0 auto 24px" }}>
          {t.hero.title}
        </h1>
        <p style={{ fontSize: 18, color: "#898989", maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.6, fontWeight: 400 }}>
          {t.hero.subtitle}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <a href="#" style={{ background: "#242424", color: "#fff", padding: "14px 32px", borderRadius: 8, fontSize: 16, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t.hero.google}
          </a>
          <a href="/dashboard" style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#242424", padding: "14px 32px", borderRadius: 8, fontSize: 16, fontWeight: 600, textDecoration: "none", background: "#fff", boxShadow: "rgba(34,42,53,0.05) 0px 4px 8px 0px" }}>
            {t.hero.email}
          </a>
        </div>
        <p style={{ fontSize: 13, color: "#898989" }}>{t.hero.noCard}</p>
      </section>

      {/* Trust Bar */}
      <section style={{ padding: "48px 24px", borderTop: "1px solid rgba(0,0,0,0.04)", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
        <p style={{ textAlign: "center", fontSize: 13, color: "#898989", marginBottom: 32, fontWeight: 500, textTransform: "uppercase", letterSpacing: "1px" }}>{t.trust}</p>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", opacity: 0.25 }}>
          {trustLogos.map(c => <span key={c} style={{ fontSize: 18, fontWeight: 700, color: "#242424" }}>{c}</span>)}
        </div>
      </section>

      {/* How it works */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px" }}>
        <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
          <div style={{ flex: "0 0 340px" }}>
            <p style={{ fontSize: 13, color: "#898989", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>{t.how.label}</p>
            <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: "#242424", marginBottom: 16 }}>{t.how.title}</h2>
            <p style={{ fontSize: 16, color: "#898989", lineHeight: 1.6, marginBottom: 32 }}>{t.how.subtitle}</p>
            <div style={{ display: "flex", gap: 12 }}>
              <a href="/dashboard" style={{ background: "#242424", color: "#fff", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t.how.cta}</a>
              <a href="/demo" style={{ border: "1px solid rgba(0,0,0,0.12)", color: "#242424", padding: "12px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>{t.how.demo}</a>
            </div>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 48 }}>
            {t.how.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 48, fontWeight: 700, color: "#e5e5e5", lineHeight: 1 }}>{step.num}</span>
                <div>
                  <h3 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 24, fontWeight: 700, color: "#242424", marginBottom: 8 }}>{step.title}</h3>
                  <p style={{ fontSize: 16, color: "#898989", lineHeight: 1.5 }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ background: "#f9fafb", padding: "96px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ fontSize: 13, color: "#898989", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: 12 }}>{t.benefits.label}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginTop: 48 }}>
            {t.benefits.items.map((item, i) => (
              <div key={i} style={{ background: "#fff", padding: 32, borderRadius: 12, boxShadow: "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px 0px" }}>
                <h3 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, color: "#242424", marginBottom: 8 }}>{item.title}</h3>
                <p style={{ fontSize: 14, color: "#898989", lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px" }}>
        <p style={{ fontSize: 13, color: "#898989", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", textAlign: "center", marginBottom: 12 }}>{t.pricing.label}</p>
        <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: "#242424", textAlign: "center", marginBottom: 12 }}>{t.pricing.title}</h2>
        <p style={{ fontSize: 16, color: "#898989", textAlign: "center", maxWidth: 500, margin: "0 auto 64px" }}>{t.pricing.subtitle}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, maxWidth: 960, margin: "0 auto" }}>
          {t.pricing.plans.map((plan, i) => (
            <div key={i} style={{ background: plan.popular ? "#242424" : "#fff", color: plan.popular ? "#fff" : "#242424", padding: 40, borderRadius: 16, boxShadow: plan.popular ? "rgba(19,19,22,0.15) 0px 4px 16px 0px" : "rgba(19,19,22,0.7) 0px 1px 5px -4px, rgba(34,42,53,0.08) 0px 0px 0px 1px, rgba(34,42,53,0.05) 0px 4px 8px 0px", position: "relative" }}>
              {plan.popular && <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#242424", color: "#fff", padding: "4px 16px", borderRadius: 9999, fontSize: 12, fontWeight: 600, border: "2px solid #fff" }}>Populaire</span>}
              <h3 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4, color: "inherit" }}>{plan.name}</h3>
              <p style={{ fontSize: 14, color: plan.popular ? "rgba(255,255,255,0.5)" : "#898989", marginBottom: 20 }}>{plan.desc}</p>
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 48, fontWeight: 700, color: "inherit" }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: plan.popular ? "rgba(255,255,255,0.5)" : "#898989" }}> /mois</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: 32 }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 14, color: "inherit", opacity: plan.popular ? 0.9 : 0.7 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> {f}
                  </li>
                ))}
              </ul>
              <a href="/dashboard" style={{ display: "block", textAlign: "center", padding: "14px 0", borderRadius: 8, fontWeight: 600, fontSize: 14, textDecoration: "none", background: plan.popular ? "#fff" : "#242424", color: plan.popular ? "#242424" : "#fff" }}>{plan.cta}</a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#242424", padding: "96px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 48, fontWeight: 700, lineHeight: 1.1, color: "#fff", marginBottom: 16 }}>Prêt à simplifier vos rendez-vous?</h2>
        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>Rejoignez les professionnels québécois qui gagnent du temps chaque semaine.</p>
        <a href="/dashboard" style={{ display: "inline-block", background: "#fff", color: "#242424", padding: "16px 40px", borderRadius: 8, fontWeight: 600, fontSize: 16, textDecoration: "none" }}>Commencer gratuitement</a>
      </section>

      {/* Footer */}
      <footer style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
        <span style={{ fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 18, fontWeight: 700, color: "#242424" }}>Planxo</span>
        <div style={{ fontSize: 13, color: "#898989" }}>
          <a href={`mailto:${t.footer.contact}`} style={{ color: "#898989", textDecoration: "underline" }}>{t.footer.contact}</a>
          <span style={{ margin: "0 8px" }}>·</span>
          <span>© {new Date().getFullYear()} {t.footer.rights}</span>
        </div>
      </footer>
    </div>
  );
}
