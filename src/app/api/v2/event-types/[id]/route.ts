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

// PATCH — Update event type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const updates: any = { updatedAt: new Date().toISOString() };
    const fieldMap: Record<string, string> = {
      title: "title", slug: "slug", description: "description",
      length: "length", price: "price", currency: "currency",
      bufferBefore: "beforeEventBuffer", bufferAfter: "afterEventBuffer",
      hidden: "hidden",
    };

    for (const [frontendField, dbField] of Object.entries(fieldMap)) {
      if (body[frontendField] !== undefined) updates[dbField] = body[frontendField];
    }

    // Handle location → locations
    if (body.location !== undefined) {
      updates.locations = [{ type: body.location }];
    }

    // Handle isActive → hidden (inverse)
    if (body.isActive !== undefined) {
      updates.hidden = !body.isActive;
    }

    const { data, error } = await supabase.from("EventType").update(updates).eq("id", id).eq("userId", user.id).select().single();
    if (error) return apiError(error.message, 500);
    if (!data) return apiError("Event type not found", 404);

    return NextResponse.json({ status: "success", data: transformEventType(data) });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

// DELETE — Remove event type (soft delete via hidden=true)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
    if (!user) return apiError("User not found", 404);

    const { error } = await supabase.from("EventType").update({ hidden: true, updatedAt: new Date().toISOString() }).eq("id", id).eq("userId", user.id);
    if (error) return apiError(error.message, 500);

    return NextResponse.json({ status: "success", data: { id } });
  } catch (e: any) {
    return apiError(e.message || "Internal error", 500);
  }
}

function apiError(message: string, status: number) {
  return NextResponse.json({ status: "error", error: { message } }, { status });
}
