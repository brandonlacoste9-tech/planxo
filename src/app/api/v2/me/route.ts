import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const eventTypes = await prisma.eventType.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: "desc" }
    });

    const schedules = await prisma.schedule.findMany({
      where: { userId: user.id },
      include: { intervals: true }
    });

    return NextResponse.json({
      ...user,
      eventTypes,
      schedules,
    });
  } catch (error: any) {
    console.error("Error fetching /api/v2/me:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabaseAuth = await createClient();
    const { data: { user: authUser } } = await supabaseAuth.auth.getUser();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const body = await req.json();
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.username !== undefined) updates.username = body.username;
    if (body.timeZone !== undefined) updates.timeZone = body.timeZone;
    if (body.conferencing !== undefined) updates.conferencing = body.conferencing;
    
    const updatedUser = await prisma.user.update({
      where: { id: authUser.id },
      data: updates
    });
    
    return Response.json({ success: true, data: updatedUser });
  } catch (error: any) {
    console.error("Error updating /api/v2/me:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
