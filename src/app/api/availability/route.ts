import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

    // 1. Ensure user exists and update timezone
    const email = user.email || "";
    const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0] || "User";
    const username = `${email.split("@")[0]}-${user.id.slice(0,4)}`;

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        ...(timezone ? { timeZone: timezone } : {})
      },
      create: {
        id: user.id,
        email: email,
        name: name,
        username: username,
        timeZone: timezone || "America/Toronto"
      },
      select: { id: true },
    });

    // 2. Get or create default schedule
    let schedule = await prisma.schedule.findFirst({
      where: { userId: user.id, isDefault: true },
    });

    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: {
          userId: user.id,
          name: scheduleName || "Working Hours",
          timeZone: timezone || "America/Toronto",
          isDefault: true
        }
      });
    } else if (scheduleName || timezone) {
      schedule = await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          name: scheduleName || schedule.name,
          timeZone: timezone || schedule.timeZone,
        }
      });
    }

    // 3. Delete old availability intervals
    await prisma.availability.deleteMany({
      where: { scheduleId: schedule.id },
    });

    // 4. Insert new intervals
    if (intervals && intervals.length > 0) {
      await prisma.availability.createMany({
        data: intervals.map((i: any) => ({
          scheduleId: schedule!.id,
          dayOfWeek: i.dayOfWeek,
          startTime: i.startTime,
          endTime: i.endTime,
          isActive: i.isActive ?? true
        }))
      });
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Error in availability API:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error",
      details: error.toString(),
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: { userId: user.id, isDefault: true },
      include: { intervals: true }
    });

    if (!schedule) {
      return NextResponse.json({ name: "Working Hours", timeZone: "America/Toronto", intervals: [] });
    }

    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error("Error in availability GET:", error);
    return NextResponse.json({ 
      error: error.message,
      details: error.toString(),
      stack: error.stack
    }, { status: 500 });
  }
}
