import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  try {
    const supabaseAuth = await createClient();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
    
    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { name, username, timeZone } = body;

    const finalName = name || authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "User";
    const finalUsername = username || authUser.email?.split("@")[0] || `user-${authUser.id.substring(0, 6)}`;
    const finalTimeZone = timeZone || "America/Toronto";

    // 1. Upsert User
    const user = await prisma.user.upsert({
      where: { id: authUser.id },
      update: {
        name: finalName,
        username: finalUsername,
        timeZone: finalTimeZone,
      },
      create: {
        id: authUser.id,
        email: authUser.email || `${authUser.id}@placeholder.planxo.com`,
        name: finalName,
        username: finalUsername,
        timeZone: finalTimeZone,
      }
    });

    // 2. Check and Create Default Schedule
    let schedId = "";
    const existingSched = await prisma.schedule.findFirst({
      where: { userId: user.id }
    });

    if (!existingSched) {
      const newSchedule = await prisma.schedule.create({
        data: {
          userId: user.id,
          name: "Working Hours",
          timeZone: finalTimeZone,
          isDefault: true,
        }
      });
      schedId = newSchedule.id;

      // Create Availability (Mon-Fri, 9-5)
      const availabilityData = [1, 2, 3, 4, 5].map((day) => ({
        scheduleId: newSchedule.id,
        dayOfWeek: day,
        startTime: "09:00:00",
        endTime: "17:00:00",
        isActive: true,
      }));

      await prisma.availability.createMany({
        data: availabilityData
      });
    } else {
      schedId = existingSched.id;
    }

    // 3. Check and Create Starter Event Types
    const existingEvents = await prisma.eventType.findFirst({
      where: { userId: user.id }
    });

    if (!existingEvents) {
      const starterTypes = [
        {
          title: "Discovery Call",
          slug: `discovery-call-${user.id.substring(0, 6)}`,
          length: 15,
          location: "google-meet",
          color: "#c8a96e",
          price: 0,
        },
        {
          title: "Consultation",
          slug: `consultation-${user.id.substring(0, 6)}`,
          length: 30,
          location: "google-meet",
          color: "#059669",
          price: 0,
        },
        {
          title: "Follow-up",
          slug: `follow-up-${user.id.substring(0, 6)}`,
          length: 60,
          location: "google-meet",
          color: "#2563eb",
          price: 0,
        },
      ];

      await prisma.eventType.createMany({
        data: starterTypes.map((et) => ({
          ...et,
          userId: user.id,
          scheduleId: schedId,
          isActive: true,
          isPrivate: false,
          currency: "cad",
          minNotice: 60,
          bufferBefore: 0,
          bufferAfter: 0,
        }))
      });
    }

    return NextResponse.json({ status: "success" });
  } catch (error: any) {
    console.error("Error during onboarding:", error);
    if (error?.code === "P2002") {
      const target = error?.meta?.target;
      if (Array.isArray(target) && target.includes("username")) {
        return NextResponse.json({ error: "Ce nom d'utilisateur est déjà pris. Veuillez en choisir un autre." }, { status: 400 });
      }
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
