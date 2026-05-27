import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const eventTypeSelect = {
  id: true,
  userId: true,
  title: true,
  slug: true,
  description: true,
  length: true,
  location: true,
  color: true,
  isActive: true,
  minNotice: true,
  bufferBefore: true,
  bufferAfter: true,
  maxPerDay: true,
  schedulingType: true,
  teamMembers: true,
  price: true,
  currency: true,
  meetingUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

const eventTypeSelectLegacy = {
  id: true,
  userId: true,
  title: true,
  slug: true,
  description: true,
  length: true,
  location: true,
  color: true,
  isActive: true,
  minNotice: true,
  bufferBefore: true,
  bufferAfter: true,
  maxPerDay: true,
  price: true,
  currency: true,
  meetingUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isMissingColumnError(error: any) {
  return error?.code === "P2022";
}

function hasSupabaseAuthConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// POST — Create event type
export async function POST(request: NextRequest) {
  try {
    if (!hasSupabaseAuthConfig()) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase environment variables" },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Ensure User exists in Prisma
    const email = user.email || "";
    const name = user.user_metadata?.full_name || user.user_metadata?.name || email.split("@")[0] || "User";
    const username = `${email.split("@")[0]}-${user.id.slice(0,4)}`;

    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: {
        id: user.id,
        email: email,
        name: name,
        username: username,
      },
      select: { id: true },
    });

    let eventType: any = null;
    try {
      eventType = await prisma.eventType.create({
        data: {
          userId: user.id,
          title: body.title || "Nouveau rendez-vous",
          slug: body.slug || `rdv-${Date.now()}`,
          description: body.description || "",
          length: body.length || 30,
          location: body.location || "google-meet",
          color: body.color || "#242424",
          price: body.price || 0,
          currency: body.currency || "cad",
          bufferBefore: body.bufferBefore ?? 0,
          bufferAfter: body.bufferAfter ?? 0,
          maxPerDay: body.maxPerDay ?? null,
          schedulingType: body.schedulingType ?? "individual",
          teamMembers: Array.isArray(body.teamMembers) ? body.teamMembers : null,
          isActive: true,
        },
        select: eventTypeSelect,
      });
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;

      eventType = await prisma.eventType.create({
        data: {
          userId: user.id,
          title: body.title || "Nouveau rendez-vous",
          slug: body.slug || `rdv-${Date.now()}`,
          description: body.description || "",
          length: body.length || 30,
          location: body.location || "google-meet",
          color: body.color || "#242424",
          price: body.price || 0,
          currency: body.currency || "cad",
          bufferBefore: body.bufferBefore ?? 0,
          bufferAfter: body.bufferAfter ?? 0,
          maxPerDay: body.maxPerDay ?? null,
          isActive: true,
        },
        select: eventTypeSelectLegacy,
      });

      eventType = {
        ...eventType,
        schedulingType: "individual",
        teamMembers: [eventType.userId],
      };
    }

    return NextResponse.json({ status: "success", data: eventType }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating event type:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error",
      details: error.toString()
    }, { status: 500 });
  }
}

// GET — List event types (optionally filter by userId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get("userId");

    let targetUserId = queryUserId;
    if (!targetUserId) {
      if (!hasSupabaseAuthConfig()) {
        return NextResponse.json(
          { error: "Server misconfigured: missing Supabase environment variables" },
          { status: 503 }
        );
      }

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      targetUserId = user?.id ?? null;
    }
    
    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let eventTypes: any[] = [];
    try {
      eventTypes = await prisma.eventType.findMany({
        where: {
          userId: targetUserId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
        select: eventTypeSelect,
      });
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;

      const legacyEventTypes = await prisma.eventType.findMany({
        where: {
          userId: targetUserId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
        select: eventTypeSelectLegacy,
      });

      eventTypes = legacyEventTypes.map((et) => ({
        ...et,
        schedulingType: "individual",
        teamMembers: [et.userId],
      }));
    }

    return NextResponse.json({ status: "success", data: eventTypes });
  } catch (error: any) {
    console.error("Error fetching event types:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error",
      details: error.toString()
    }, { status: 500 });
  }
}
