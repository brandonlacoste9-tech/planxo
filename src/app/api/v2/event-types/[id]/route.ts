import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// PATCH — Update event type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data: user } = await supabase.from("User").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const updates: any = { updatedAt: new Date().toISOString() };
    const fields = ["title","slug","description","length","location","color","price","currency","bufferBefore","bufferAfter","maxPerDay","isActive"];
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    const { data, error } = await supabase.from("EventType").update(updates).eq("id", id).eq("userId", user.id).select().single();
    if (error) return apiError(error.message, 500);
    if (!data) return apiError("Event type not found", 404);

    return NextResponse.json({ status: "success", data });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

// DELETE — Remove event type (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: user } = await supabase.from("User").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const { error } = await supabase.from("EventType").update({ isActive: false, updatedAt: new Date().toISOString() }).eq("id", id).eq("userId", user.id);
    if (error) return apiError(error.message, 500);

    return NextResponse.json({ status: "success", data: { id } });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
