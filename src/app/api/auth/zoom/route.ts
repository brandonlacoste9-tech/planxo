import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ZOOM_AUTH_URL = "https://zoom.us/oauth/authorize";
const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";

function getBasicAuthHeader(clientId: string, clientSecret: string) {
  const raw = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(`${request.nextUrl.origin}/login`);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "ZOOM_CLIENT_ID or ZOOM_CLIENT_SECRET missing" }, { status: 500 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/zoom`;

  if (code) {
    const tokenRes = await fetch(
      `${ZOOM_TOKEN_URL}?grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
      {
        method: "POST",
        headers: {
          Authorization: getBasicAuthHeader(clientId, clientSecret),
        },
      }
    );

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || tokens.error) {
      return NextResponse.json({ error: tokens.reason || tokens.error || "Zoom OAuth failed" }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    let accountEmail = "";
    try {
      const meRes = await fetch("https://api.zoom.us/v2/users/me", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      const me = await meRes.json();
      accountEmail = me?.email || "";
    } catch {
      accountEmail = "";
    }

    await supabase.from("connected_calendars").delete().eq("user_id", user.id).eq("provider", "zoom");
    await supabase.from("connected_calendars").insert({
      user_id: user.id,
      provider: "zoom",
      account_email: accountEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: expiresAt,
      delta_token: null,
      sync_status: "idle",
    });

    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard?connected=zoom`);
  }

  const authUrl = `${ZOOM_AUTH_URL}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return NextResponse.redirect(authUrl);
}
