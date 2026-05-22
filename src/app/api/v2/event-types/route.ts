import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabase
    .from("EventType")
    .select("*")
    .eq("isActive", true)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { data: user } = await supabase.from("User").select("id").limit(1).single();
  if (!user) return NextResponse.json({ error: "No user found" }, { status: 400 });

  const slug = body.slug || body.title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const { data, error } = await supabase.from("EventType").insert({
    userId: user.id,
    title: body.title,
    slug,
    description: body.description || "",
    length: body.length || 30,
    location: body.location || "google-meet",
    color: body.color || "#242424",
    updatedAt: new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
