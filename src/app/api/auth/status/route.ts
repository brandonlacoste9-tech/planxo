import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PLANXO_USER_ID = "u1";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: connectedCalendars } = await supabase
    .from("connected_calendars")
    .select("provider, expires_at, created_at, account_email")
    .eq("user_id", PLANXO_USER_ID);

  const connected: Record<string, boolean> = {
    google: false,
    outlook: false,
    zoom: false,
  };

  for (const c of connectedCalendars || []) {
    if (typeof c.provider === "string") {
      connected[c.provider] = true;
    }
  }

  return NextResponse.json({
    status: "success",
    data: {
      connected,
      credentials: (connectedCalendars || []).map((c: any) => ({
        type: c.provider,
        expiresAt: c.expires_at,
        accountEmail: c.account_email,
        connectedAt: c.created_at,
      })),
    },
  });
}
