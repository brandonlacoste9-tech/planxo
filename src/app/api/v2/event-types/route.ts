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

const eventTypeSelectMinimal = {
  id: true,
  userId: true,
  title: true,
  slug: true,
  description: true,
  length: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isMissingColumnError(error: any) {
  return error?.code === "P2022";
}

function isUniqueConstraintError(error: any) {
  return error?.code === "P2002";
}

function parseMissingColumn(error: any) {
  const columnFromMeta = error?.meta?.column;
  if (typeof columnFromMeta === "string" && columnFromMeta.length > 0) {
    const raw = columnFromMeta.split(".").pop() || columnFromMeta;
    return raw.replace(/[^a-zA-Z0-9_]/g, "");
  }

  const message = String(error?.message || "");
  const match = message.match(/column [`"]?([a-zA-Z0-9_]+)[`"]?/i);
  return match?.[1] || null;
}

function generateEventTypeId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// Map a user's stored conferencing preference (a display label) to an event-type location value.
function conferencingToLocation(conferencing: unknown): string | null {
  if (typeof conferencing !== "string") return null;
  const normalized = conferencing.toLowerCase();
  if (normalized.includes("zoom")) return "zoom";
  if (normalized.includes("teams")) return "teams";
  if (normalized.includes("phone") || normalized.includes("téléphone") || normalized.includes("telephone")) return "phone";
  if (normalized.includes("meet") || normalized.includes("google")) return "google-meet";
  return null;
}

async function createEventTypeLegacyInsert(params: {
  userId: string;
  title: string;
  slug: string;
  length: number;
}) {
  const id = generateEventTypeId();
  await prisma.$executeRawUnsafe(
    'INSERT INTO "public"."EventType" ("id", "userId", "title", "slug", "length", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
    id,
    params.userId,
    params.title,
    params.slug,
    params.length
  );

  return { id };
}

async function createEventTypeCompat(params: {
  userId: string;
  title: string;
  slug: string;
  length: number;
}) {
  try {
    return await prisma.eventType.create({
      data: {
        userId: params.userId,
        title: params.title,
        slug: params.slug,
        length: params.length,
      },
      select: { id: true },
    });
  } catch (error: any) {
    if (!isMissingColumnError(error)) throw error;
    return createEventTypeLegacyInsert(params);
  }
}

function withEventTypeDefaults(eventType: any) {
  if (!eventType) return eventType;
  return {
    ...eventType,
    location: eventType.location ?? "google-meet",
    color: eventType.color ?? "#242424",
    minNotice: eventType.minNotice ?? 60,
    bufferBefore: eventType.bufferBefore ?? 0,
    bufferAfter: eventType.bufferAfter ?? 0,
    maxPerDay: eventType.maxPerDay ?? null,
    price: eventType.price ?? 0,
    currency: eventType.currency ?? "cad",
    meetingUrl: eventType.meetingUrl ?? null,
    schedulingType: eventType.schedulingType ?? "individual",
    teamMembers:
      eventType.teamMembers ??
      (eventType.userId ? [eventType.userId] : null),
  };
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

    try {
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
    } catch (error: any) {
      if (!isUniqueConstraintError(error)) throw error;

      // Legacy data can contain conflicting unique username/email rows for recreated auth users.
      const fallbackEmail = `${user.id}@planxo.local`;
      await prisma.user.upsert({
        where: { id: user.id },
        update: {
          name,
        },
        create: {
          id: user.id,
          email: fallbackEmail,
          name,
          username: `user-${user.id.slice(0, 8)}`,
        },
        select: { id: true },
      });
    }

    const baseSlug = body.slug || `rdv-${Date.now()}`;

    const createTitle = body.title || "Nouveau rendez-vous";
    const createLength = body.length || 30;

    let created: { id: string } | null = null;
    try {
      created = await createEventTypeCompat({
        userId: user.id,
        title: createTitle,
        slug: baseSlug,
        length: createLength,
      });
    } catch (error: any) {
      if (!isUniqueConstraintError(error)) throw error;

      created = await createEventTypeCompat({
        userId: user.id,
        title: createTitle,
        slug: `${baseSlug}-${Date.now().toString().slice(-4)}`,
        length: createLength,
      });
    }

    // Default new event types to the user's global conferencing preference when no
    // explicit location is provided.
    let preferredLocation: string | null = null;
    if (!body.location) {
      try {
        // `conferencing` is added to the users table via raw SQL migration and is not in the
        // Prisma schema, so read it with a raw query.
        const rows = await prisma.$queryRaw<{ conferencing: string | null }[]>`
          SELECT "conferencing" FROM "public"."User" WHERE "id" = ${user.id} LIMIT 1
        `;
        preferredLocation = conferencingToLocation(rows?.[0]?.conferencing);
      } catch {
        preferredLocation = null;
      }
    }

    const optionalUpdates: Record<string, any> = {
      description: body.description || "",
      location: body.location || preferredLocation || "google-meet",
      color: body.color || "#242424",
      price: body.price || 0,
      currency: body.currency || "cad",
      bufferBefore: body.bufferBefore ?? 0,
      bufferAfter: body.bufferAfter ?? 0,
      maxPerDay: body.maxPerDay ?? null,
      schedulingType: body.schedulingType ?? "individual",
      teamMembers: Array.isArray(body.teamMembers) ? body.teamMembers : null,
      isActive: true,
    };

    // Best-effort compatibility update for environments with legacy schemas.
    for (let i = 0; i < 10 && Object.keys(optionalUpdates).length > 0; i++) {
      try {
        await prisma.eventType.update({
          where: { id: created.id },
          data: optionalUpdates,
          select: { id: true },
        });
        break;
      } catch (error: any) {
        if (!isMissingColumnError(error)) {
          break;
        }

        const missingColumn = parseMissingColumn(error);
        if (missingColumn && missingColumn in optionalUpdates) {
          delete optionalUpdates[missingColumn];
          continue;
        }

        delete optionalUpdates.schedulingType;
        delete optionalUpdates.teamMembers;
      }
    }

    let eventType: any = null;
    const where = { id: created.id };
    try {
      eventType = await prisma.eventType.findUnique({
        where,
        select: eventTypeSelect,
      });
    } catch (selectError: any) {
      if (!isMissingColumnError(selectError)) throw selectError;

      try {
        eventType = await prisma.eventType.findUnique({
          where,
          select: eventTypeSelectLegacy,
        });
      } catch (legacySelectError: any) {
        if (!isMissingColumnError(legacySelectError)) throw legacySelectError;

        eventType = await prisma.eventType.findUnique({
          where,
          select: eventTypeSelectMinimal,
        });
      }
    }

    return NextResponse.json(
      { status: "success", data: withEventTypeDefaults(eventType) },
      { status: 201 }
    );
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
