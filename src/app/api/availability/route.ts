import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { scheduleName, intervals } = body;

  // Get the default user
  const { data: user } = await supabase.from("users").select("id").eq("email", "info@planxo.ca").single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Upsert schedule (no isDefault/createdAt/updatedAt — use cal.diy schema)
  const { data: existing } = await supabase.from("Schedule").select("id").eq("userId", user.id).single();

  let scheduleId: number;
  if (existing) {
    scheduleId = existing.id;
    await supabase.from("Schedule").update({ name: scheduleName }).eq("id", scheduleId);
  } else {
    const { data: newSched } = await supabase.from("Schedule").insert({
      userId: user.id, name: scheduleName, timeZone: "America/Toronto",
    }).select("id").single();
    scheduleId = newSched.id;
  }

  // Delete old availability and insert new one (days array format)
  await supabase.from("Availability").delete().eq("scheduleId", scheduleId).eq("userId", user.id);

  // Group intervals by day of week into a days array
  const days: number[] = [];
  let startTime = "09:00:00";
  let endTime = "17:00:00";

  for (const i of intervals) {
    if (i.isActive && !days.includes(i.dayOfWeek)) {
      days.push(i.dayOfWeek);
    }
    if (i.startTime) startTime = i.startTime.length === 5 ? i.startTime + ":00" : i.startTime;
    if (i.endTime) endTime = i.endTime.length === 5 ? i.endTime + ":00" : i.endTime;
  }

  if (days.length > 0) {
    const { error } = await supabase.from("Availability").insert({
      userId: user.id,
      scheduleId,
      days,
      startTime,
      endTime,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success" });
}
