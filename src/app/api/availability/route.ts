import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleName, timezone, intervals } = body;

    // 1. Update user timezone
    if (timezone) {
      await supabase.from("User").update({ timeZone: timezone }).eq("id", user.id);
    }

    // 2. Get or create default schedule
    let { data: schedule } = await supabase
      .from("Schedule")
      .select("id")
      .eq("userId", user.id)
      .eq("isDefault", true)
      .single();

    if (!schedule) {
      const { data: newSchedule, error: createError } = await supabase
        .from("Schedule")
        .insert({
          userId: user.id,
          name: scheduleName || "Working Hours",
          timeZone: timezone || "America/Toronto",
          isDefault: true
        })
        .select("id")
        .single();
      
      if (createError) throw createError;
      schedule = newSchedule;
    } else if (scheduleName) {
      await supabase.from("Schedule").update({ name: scheduleName }).eq("id", schedule.id);
    }

    // 3. Delete old availability intervals
    await supabase.from("Availability").delete().eq("scheduleId", schedule.id);

    // 4. Insert new intervals
    if (intervals && intervals.length > 0) {
      const { error: insertError } = await supabase.from("Availability").insert(
        intervals.map((i: any) => ({
          scheduleId: schedule.id,
          dayOfWeek: i.dayOfWeek,
          startTime: i.startTime,
          endTime: i.endTime,
          isActive: i.isActive ?? true
        }))
      );
      if (insertError) throw insertError;
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Error in availability API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: schedule } = await supabase
      .from("Schedule")
      .select(`
        id,
        name,
        timeZone,
        intervals:Availability(*)
      `)
      .eq("userId", user.id)
      .eq("isDefault", true)
      .single();

    return NextResponse.json(schedule || { name: "Working Hours", timeZone: "America/Toronto", intervals: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
