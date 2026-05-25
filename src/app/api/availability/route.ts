import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleName, timezone, intervals } = body;

    // 1. Ensure user exists in Prisma and update timezone
    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: { timeZone: timezone || "America/Toronto" },
      create: {
        id: authUser.id,
        email: authUser.email!,
        name: authUser.user_metadata?.name || authUser.email!.split('@')[0],
        username: authUser.user_metadata?.username || authUser.email!.split('@')[0],
        timeZone: timezone || "America/Toronto",
      },
    });

    // 2. Get or create default schedule
    let schedule = await prisma.schedule.findFirst({
      where: {
        userId: user.id,
        isDefault: true,
      },
    });

    if (!schedule) {
      schedule = await prisma.schedule.create({
        data: {
          userId: user.id,
          name: scheduleName || "Working Hours",
          timeZone: timezone || "America/Toronto",
          isDefault: true,
        },
      });
    } else if (scheduleName || timezone) {
      schedule = await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          name: scheduleName || schedule.name,
          timeZone: timezone || schedule.timeZone,
        },
      });
    }

    // 3. Update intervals (Delete old, create new in a transaction)
    await prisma.$transaction([
      prisma.availability.deleteMany({
        where: { scheduleId: schedule.id },
      }),
      prisma.availability.createMany({
        data: (intervals || []).map((i: any) => ({
          scheduleId: schedule.id,
          dayOfWeek: i.dayOfWeek,
          startTime: i.startTime,
          endTime: i.endTime,
          isActive: i.isActive ?? true,
        })),
      }),
    ]);

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Error in availability API:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedule = await prisma.schedule.findFirst({
      where: {
        userId: authUser.id,
        isDefault: true,
      },
      include: {
        intervals: true,
      },
    });

    if (!schedule) {
      return NextResponse.json({ name: "Working Hours", timeZone: "America/Toronto", intervals: [] });
    }

    return NextResponse.json(schedule);
  } catch (error: any) {
    console.error("Error in availability GET:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
