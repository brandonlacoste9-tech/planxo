
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const userId = searchParams.get("userId"); // In a full flow, this comes from session/state

  if (!code || !userId) {
    return NextResponse.json({ error: "Authorization code or User ID missing" }, { status: 400 });
  }

  try {
    // 1. Exchange Authorization Code for Tokens
    const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/token`;
    
    const payload = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/outlook`,
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
    }

    const tokens = await response.json();

    // 2. Fetch User Profile to get the primary email
    const userResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userResponse.json();

    // 3. Atomic commit to the OutlookAccount vault
    const account = await prisma.outlookAccount.upsert({
      where: { userId: userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        email: profile.mail || profile.userPrincipalName,
      },
      create: {
        userId: userId,
        email: profile.mail || profile.userPrincipalName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    // 4. Redirect back to the dashboard with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?sync=success`);

  } catch (error: any) {
    console.error("[OAuth Callback Error]:", error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?error=auth_failed`);
  }
}
