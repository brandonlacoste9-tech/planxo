import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { scheduleName, intervals } = body;

  // Get the default user for now (until multi-user is wired)
  const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert default schedule
  const { data: existing } = await supabase.from("Schedule").select("id").eq("userId", user.id).eq("isDefault", true).single();

  let scheduleId: string;
  if (existing) {
    scheduleId = existing.id;
    await supabase.from("Schedule").update({ name: scheduleName, updatedAt: new Date().toISOString() }).eq("id", scheduleId);
  } else {
    scheduleId = crypto.randomUUID();
    await supabase.from("Schedule").insert({
      id: scheduleId, userId: user.id, name: scheduleName,
      timeZone: "America/Toronto", isDefault: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  }

  // Delete old intervals and insert new ones
  await supabase.from("Availability").delete().eq("scheduleId", scheduleId);

  const rows = intervals.map((i: any) => ({
    id: crypto.randomUUID(),
    scheduleId,
    dayOfWeek: i.dayOfWeek,
    startTime: i.startTime,
    endTime: i.endTime,
    isActive: i.isActive,
  }));

  const { error } = await supabase.from("Availability").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
