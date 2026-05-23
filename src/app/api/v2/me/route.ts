import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  let userQuery = supabase.from("users").select("*");

  if (username) {
    userQuery = userQuery.eq("username", username);
  } else {
    userQuery = userQuery.eq("email", "info@planxo.ca");
  }

  const { data: user } = await userQuery.single();

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: eventTypes } = await supabase
    .from("EventType")
    .select("*")
    .eq("userId", user.id)
    .eq("hidden", false)
    .order("createdAt", { ascending: false });

  const { data: schedules } = await supabase
    .from("Schedule")
    .select("*, availabilities:Availability(*)")
    .eq("userId", user.id);

  // Expand days[] array to per-day interval objects for frontend
  const expandedSchedules = (schedules || []).map((s: any) => ({
    ...s,
    intervals: (s.availabilities || []).flatMap((a: any) => {
      const st = typeof a.startTime === "string" ? a.startTime.slice(0, 5) : "09:00";
      const et = typeof a.endTime === "string" ? a.endTime.slice(0, 5) : "17:00";
      if (Array.isArray(a.days)) {
        return a.days.map((d: number) => ({
          id: `avail-${a.id}-${d}`,
          scheduleId: a.scheduleId,
          dayOfWeek: d,
          startTime: st,
          endTime: et,
          isActive: true,
        }));
      }
      return [];
    }),
  }));

  return NextResponse.json({
    ...user,
    eventTypes: eventTypes || [],
    schedules: expandedSchedules,
  });
}
