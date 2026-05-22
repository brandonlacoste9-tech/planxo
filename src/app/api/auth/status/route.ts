import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const PLANXO_USER_ID = "u1";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: creds } = await supabase
    .from("Credential")
    .select("type, expiresAt, scope, createdAt")
    .eq("userId", PLANXO_USER_ID);

  const connected: Record<string, boolean> = {
    google: false,
    outlook: false,
  };

  for (const c of creds || []) {
    connected[c.type] = true;
  }

  return NextResponse.json({
    status: "success",
    data: {
      connected,
      credentials: (creds || []).map((c) => ({
        type: c.type,
        expiresAt: c.expiresAt,
        scope: c.scope,
        connectedAt: c.createdAt,
      })),
    },
  });
}
