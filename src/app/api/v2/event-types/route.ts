import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Transform cal.diy DB columns to frontend-friendly format
function transformEventType(et: any) {
  if (!et) return et;
  let location = "google-meet";
  if (Array.isArray(et.locations) && et.locations.length > 0) {
    location = et.locations[0]?.type || "google-meet";
  }
  return {
    ...et,
    location,
    isActive: !et.hidden,
    bufferBefore: et.beforeEventBuffer ?? 0,
    bufferAfter: et.afterEventBuffer ?? 0,
  };
}

// POST — Create event type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const now = new Date().toISOString();
    const locType = body.location || "integrations:google:meet";

    const { data, error } = await supabase.from("EventType").insert({
      userId: user.id,
      title: body.title || "Nouveau rendez-vous",
      slug: body.slug || `rdv-${Date.now()}`,
      description: body.description || "",
      length: body.length || 30,
      locations: [{ type: locType }],
      price: body.price || 0,
      currency: body.currency || "cad",
      beforeEventBuffer: body.bufferBefore ?? 0,
      afterEventBuffer: body.bufferAfter ?? 0,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    }).select().single();

    if (error) return apiError(error.message, 500);
    return NextResponse.json({ status: "success", data: transformEventType(data) }, { status: 201 });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

// GET — List event types (optionally filter by userId)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  let query = supabase.from("EventType").select("*").eq("hidden", false).order("createdAt", { ascending: false });

  if (userId) {
    query = query.eq("userId", userId);
  } else {
    const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);
    query = query.eq("userId", user.id);
  }

  const { data, error } = await query;
  if (error) return apiError(error.message, 500);
  return NextResponse.json({
    status: "success",
    data: (data || []).map(transformEventType),
  });
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
