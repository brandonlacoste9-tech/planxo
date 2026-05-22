import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST — Create event type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data: user } = await supabase.from("User").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data, error } = await supabase.from("EventType").insert({
      id,
      userId: user.id,
      title: body.title || "Nouveau rendez-vous",
      slug: body.slug || `rdv-${id.slice(0, 8)}`,
      description: body.description || "",
      length: body.length || 30,
      location: body.location || "google-meet",
      color: body.color || "#242424",
      price: body.price || 0,
      currency: body.currency || "cad",
      bufferBefore: body.bufferBefore ?? 0,
      bufferAfter: body.bufferAfter ?? 0,
      maxPerDay: body.maxPerDay ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).select().single();

    if (error) return apiError(error.message, 500);
    return NextResponse.json({ status: "success", data }, { status: 201 });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

// GET — List event types
export async function GET() {
  const { data: user } = await supabase.from("User").select("id").eq("email", "info@planxo.ca").single();
  if (!user) return apiError("User not found", 404);

  const { data, error } = await supabase.from("EventType").select("*").eq("userId", user.id).order("createdAt", { ascending: false });
  if (error) return apiError(error.message, 500);

  return NextResponse.json({ status: "success", data: data || [] });
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
