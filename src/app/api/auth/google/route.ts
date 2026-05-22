import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const PLANXO_USER_ID = "u1"; // Default user until multi-user auth is built

function getEnv(key: string) {
  return process.env[key] || "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const action = searchParams.get("action");

  // ── Disconnect ──
  if (action === "disconnect") {
    await supabase.from("Credential").delete().eq("userId", PLANXO_USER_ID).eq("type", "google");
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?disconnected=google`);
  }

  // ── Step 2: Exchange code for tokens ──
  if (code) {
    const clientId = getEnv("GOOGLE_CLIENT_ID");
    const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
    const redirectUri = `${request.nextUrl.origin}/api/auth/google`;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Google OAuth not configured." }, { status: 500 });
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 });
    }

    // Store tokens in Supabase
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    // Upsert: delete old then insert new
    await supabase.from("Credential").delete().eq("userId", PLANXO_USER_ID).eq("type", "google");
    await supabase.from("Credential").insert({
      id: crypto.randomUUID(),
      userId: PLANXO_USER_ID,
      type: "google",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      scope: tokens.scope || "",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(`${request.nextUrl.origin}/settings?connected=google`);
  }

  // ── Step 1: Redirect to Google ──
  const clientId = getEnv("GOOGLE_CLIENT_ID");
  if (!clientId) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured." }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google`;
  const scope = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";
  const authUrl = `${GOOGLE_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=planxo`;

  return NextResponse.redirect(authUrl);
}
