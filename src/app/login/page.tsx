"use client";

import { useState, Suspense } from "react";
import { useTheme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

const { colors } = useTheme();
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
      });
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage("Vérifiez votre courriel pour confirmer votre inscription.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push(redirect);
    router.refresh();
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    });
    if (error) setError(error.message);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: colors.bg, fontFamily: "'Inter', system-ui, sans-serif", position: "relative", zIndex: 1,
    }}>
      <div style={{
        background: colors.cardBg || "#fff", borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 400,
        border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
      }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <h1 style={{
            fontFamily: "'Cal Sans', 'Inter', sans-serif", fontSize: 28, fontWeight: 700,
            color: colors.text, marginBottom: 4, textAlign: "center",
          }}>Planxo</h1>
        </a>
        <p style={{ textAlign: "center", fontSize: 14, color: colors.textMuted, marginBottom: 28 }}>
          {mode === "login" ? "Connectez-vous à votre compte" : "Créez votre compte"}
        </p>

        {message && (
          <div style={{
            background: "#ecfdf5", color: "#059669", padding: "12px 16px", borderRadius: 8,
            fontSize: 13, marginBottom: 16, textAlign: "center",
        <p style={{ textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: 32, letterSpacing: "0.5px" }}>
          Fait au Québec • Pour le Québec
        </p>
          }}>{message}</div>
        )}

        <button
          onClick={handleGoogleLogin}
          style={{
            width: "100%", padding: "12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
            background: colors.cardBg || "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            fontFamily: "'Inter', sans-serif", marginBottom: 16, transition: "background .15s",
          }}
          className="google-btn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continuer avec Google
        </button>

        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16, color: "#d1d5db",
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
          <span style={{ fontSize: 12, color: colors.textMuted }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.06)" }} />
        <p style={{ textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: 32, letterSpacing: "0.5px" }}>
          Fait au Québec • Pour le Québec
        </p>
        </div>

        <form onSubmit={handleEmailLogin}>
          <input
            type="email" placeholder="Courriel" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Mot de passe" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={6}
            style={inputStyle}
          />
          {error && (
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 8, border: "none",
            background: "#242424", color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: "pointer", fontFamily: "'Inter', sans-serif", marginTop: 4,
            opacity: loading ? 0.7 : 1, transition: "all .15s",
          }}>
            {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "S'inscrire"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 13, color: colors.textMuted, marginTop: 20 }}>
          {mode === "login" ? "Pas encore de compte?" : "Déjà un compte?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}
            style={{
              background: "none", border: "none", color: colors.text, fontWeight: 600,
              cursor: "pointer", fontSize: 13, fontFamily: "'Inter', sans-serif",
              textDecoration: "underline",
            }}
          >
            {mode === "login" ? "S'inscrire" : "Se connecter"}
          </button>
        </p>
        <p style={{ textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: 32, letterSpacing: "0.5px" }}>
          Fait au Québec • Pour le Québec
        </p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `.google-btn:hover { background: #f9fafb; border-color: rgba(0,0,0,0.2); }` }} />
        <p style={{ textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: 32, letterSpacing: "0.5px" }}>
          Fait au Québec • Pour le Québec
        </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f9fafb"}}>
        <p style={{fontSize:14,color:"#898989"}}>Chargement...</p>
        <p style={{ textAlign: "center", fontSize: 11, color: colors.textMuted, marginTop: 32, letterSpacing: "0.5px" }}>
          Fait au Québec • Pour le Québec
        </p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.12)", fontSize: 14, fontFamily: "'Inter', sans-serif",
  outline: "none", marginBottom: 10,
};
