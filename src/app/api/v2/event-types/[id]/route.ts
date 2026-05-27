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

// GET — Fetch a single event type by id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!hasSupabaseAuthConfig()) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase environment variables" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let eventType: any = null;
    try {
      eventType = await prisma.eventType.findUnique({
        where: { id: id },
        select: eventTypeSelect,
      });
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;

      eventType = await prisma.eventType.findUnique({
        where: { id: id },
        select: eventTypeSelectLegacy,
      });

      if (eventType) {
        eventType = {
          ...eventType,
          schedulingType: "individual",
          teamMembers: [eventType.userId],
        };
      }
    }

    if (!eventType || eventType.userId !== user.id || !eventType.isActive) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    return NextResponse.json({ status: "success", data: eventType });
  } catch (error: any) {
    console.error("Error fetching event type:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// PATCH — Update event type
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!hasSupabaseAuthConfig()) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase environment variables" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Verify ownership
    const existing = await prisma.eventType.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    const updates: any = {};
    const allowedFields = ["title", "slug", "description", "length", "location", "color", "price", "currency", "bufferBefore", "bufferAfter", "maxPerDay", "schedulingType", "teamMembers", "isActive"];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    let eventType: any = null;
    try {
      eventType = await prisma.eventType.update({
        where: { id },
        data: updates,
        select: eventTypeSelect,
      });
    } catch (error: any) {
      if (!isMissingColumnError(error)) throw error;

      const legacyUpdates = { ...updates };
      delete legacyUpdates.schedulingType;
      delete legacyUpdates.teamMembers;

      eventType = await prisma.eventType.update({
        where: { id },
        data: legacyUpdates,
        select: eventTypeSelectLegacy,
      });

      eventType = {
        ...eventType,
        schedulingType: "individual",
        teamMembers: [eventType.userId],
      };
    }

    return NextResponse.json({ status: "success", data: eventType });
  } catch (error: any) {
    console.error("Error updating event type:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// DELETE — Remove event type (soft delete via isActive=false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!hasSupabaseAuthConfig()) {
      return NextResponse.json(
        { error: "Server misconfigured: missing Supabase environment variables" },
        { status: 503 }
      );
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.eventType.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Event type not found" }, { status: 404 });
    }

    await prisma.eventType.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({ status: "success", data: { id } });
  } catch (error: any) {
    console.error("Error deleting event type:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
