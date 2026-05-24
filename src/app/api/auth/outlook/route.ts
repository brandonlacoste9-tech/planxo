import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OUTLOOK_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${request.nextUrl.origin}/login`);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const clientId = process.env.OUTLOOK_CLIENT_ID!;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET!;
    const redirectUri = `${request.nextUrl.origin}/api/auth/outlook`;

    const tokenRes = await fetch(OUTLOOK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("connected_calendars").delete().eq("user_id", user.id).eq("provider", "outlook");
    await supabase.from("connected_calendars").insert({
      user_id: user.id,
      provider: "outlook",
      account_email: tokens.email || "",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at: expiresAt,
      delta_token: null,
      sync_status: "idle",
    });

    return NextResponse.redirect(`${request.nextUrl.origin}/dashboard?connected=outlook`);
  }

  // Redirect to Microsoft
  const clientId = process.env.OUTLOOK_CLIENT_ID!;
  const redirectUri = `${request.nextUrl.origin}/api/auth/outlook`;
  const scope = "offline_access https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/Calendars.ReadWrite";
  const authUrl = `${OUTLOOK_AUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  return NextResponse.redirect(authUrl);
}
