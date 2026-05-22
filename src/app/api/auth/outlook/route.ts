import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const PLANXO_USER_ID = "u1";

function getEnv(key: string) {
  return process.env[key] || "";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const action = searchParams.get("action");

  // ── Disconnect ──
  if (action === "disconnect") {
    await supabase.from("Credential").delete().eq("userId", PLANXO_USER_ID).eq("type", "outlook");
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?disconnected=outlook`);
  }

  // ── Step 2: Exchange code for tokens ──
  if (code) {
    const clientId = getEnv("OUTLOOK_CLIENT_ID");
    const clientSecret = getEnv("OUTLOOK_CLIENT_SECRET");
    const redirectUri = `${request.nextUrl.origin}/api/auth/outlook`;

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "Outlook OAuth not configured." }, { status: 500 });
    }

    const tokenRes = await fetch(OUTLOOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 });
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;

    await supabase.from("Credential").delete().eq("userId", PLANXO_USER_ID).eq("type", "outlook");
    await supabase.from("Credential").insert({
      id: crypto.randomUUID(),
      userId: PLANXO_USER_ID,
      type: "outlook",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt,
      scope: tokens.scope || "",
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(`${request.nextUrl.origin}/settings?connected=outlook`);
  }

  // ── Step 1: Redirect to Microsoft ──
  const clientId = getEnv("OUTLOOK_CLIENT_ID");
  if (!clientId) {
    return NextResponse.json({ error: "OUTLOOK_CLIENT_ID not configured." }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/outlook`;
  const scope = "offline_access https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Calendars.ReadWrite";
  const authUrl = `${OUTLOOK_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=planxo`;

  return NextResponse.redirect(authUrl);
}
