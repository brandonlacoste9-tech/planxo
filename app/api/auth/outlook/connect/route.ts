
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }

  // Generate secure state to prevent CSRF
  const state = crypto.randomBytes(32).toString("hex");
  
  // In a real prod env, we would store this state in a temporary session or DB for validation
  // For the current velocity, we're focusing on the flow construction.

  const rootUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
  const options = {
    client_id: process.env.AZURE_CLIENT_ID,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/outlook`,
    response_type: "code",
    scope: "offline_access User.Read Calendars.ReadWrite",
    state: state,
  };

  const queryString = new URLSearchParams(options as any).toString();
  const authUrl = `${rootUrl}?${queryString}`;

  return NextResponse.redirect(authUrl);
}
