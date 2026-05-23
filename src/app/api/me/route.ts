import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Look up user in the public.users table by uuid
  const { data: profile } = await supabase
    .from("users")
    .select("id, uuid, username, name, email, timeZone, completedOnboarding")
    .eq("uuid", user.id)
    .single();

  return NextResponse.json({
    ...user,
    profile: profile || null,
  });
}

export async function PUT(request: NextRequest) {
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { name, username, timeZone } = body;

  // Check if user already exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("uuid", user.id)
    .single();

  if (existing) {
    await supabase
      .from("users")
      .update({
        name: name || user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        username: username || "",
        timeZone: timeZone || "America/Toronto",
        completedOnboarding: true,
      })
      .eq("uuid", user.id);
  } else {
    await supabase
      .from("users")
      .insert({
        uuid: user.id,
        email: user.email || "",
        name: name || user.user_metadata?.full_name || user.email?.split("@")[0] || "",
        username: username || "",
        timeZone: timeZone || "America/Toronto",
        completedOnboarding: true,
      });
  }

  // Get userId (either from existing or newly created)
  const { data: profile } = await supabase
    .from("users").select("id").eq("uuid", user.id).single();
  const userId = profile?.id;

  // Auto-create default schedule + availability if none exists
  if (userId) {
    const { data: existingSched } = await supabase
      .from("Schedule").select("id").eq("userId", userId).single();

    if (!existingSched) {
      const { data: sched } = await supabase
        .from("Schedule")
        .insert({ userId, name: "Heures de travail", timeZone: timeZone || "America/Toronto" })
        .select("id").single();

      if (sched) {
        await supabase.from("Availability").insert({
          userId,
          scheduleId: sched.id,
          days: [0, 1, 2, 3, 4, 5, 6],
          startTime: "09:00:00",
          endTime: "17:00:00",
        });
      }
    }
  }

  return NextResponse.json({ status: "success" });
}
