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

  if (userId) {
    const tz = timeZone || "America/Toronto";

    // ── Schedule + Availability ──────────────────────────────────────────────
    const { data: existingSched } = await supabase
      .from("Schedule").select("id").eq("userId", userId).single();

    let schedId: string | number | null = existingSched?.id ?? null;

    if (!existingSched) {
      const { data: sched } = await supabase
        .from("Schedule")
        .insert({ userId, name: "Heures de travail", timeZone: tz })
        .select("id").single();

      if (sched) {
        schedId = sched.id;
        // Mon–Fri (1–5)
        await supabase.from("Availability").insert({
          userId,
          scheduleId: sched.id,
          days: [1, 2, 3, 4, 5],
          startTime: "09:00:00",
          endTime: "17:00:00",
        });
      }
    }

    // ── Starter Event Types ──────────────────────────────────────────────────
    const { data: existingETs } = await supabase
      .from("EventType").select("id").eq("userId", userId).limit(1);

    if (!existingETs || existingETs.length === 0) {
      const now = new Date().toISOString();
      const starterTypes = [
        {
          title: "Appel découverte",
          slug: `appel-decouverte-${userId.slice(-6)}`,
          length: 15,
          location: "google-meet",
          price: 0,
          position: 1,
        },
        {
          title: "Consultation",
          slug: `consultation-${userId.slice(-6)}`,
          length: 30,
          location: "google-meet",
          price: 0,
          position: 2,
        },
        {
          title: "Réunion de suivi",
          slug: `reunion-suivi-${userId.slice(-6)}`,
          length: 60,
          location: "google-meet",
          price: 0,
          position: 3,
        },
      ];

      for (const et of starterTypes) {
        await supabase.from("EventType").insert({
          userId,
          title: et.title,
          slug: et.slug,
          length: et.length,
          location: et.location,
          price: et.price,
          color: "#c8a96e",
          isActive: true,
          isPrivate: false,
          position: et.position,
          currency: "cad",
          minNotice: 60,
          bufferBefore: 0,
          bufferAfter: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return NextResponse.json({ status: "success" });
}
