import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rateLimit";
import crypto from "crypto";

function normalizeSchedulingType(value: unknown): "individual" | "round_robin" | "collective" | "pooled" {
  if (typeof value !== "string") return "individual";
  const normalized = value.toLowerCase();
  if (normalized === "round_robin" || normalized === "collective" || normalized === "pooled") {
    return normalized;
  }
  return "individual";
}

function normalizeTeamMembers(value: unknown, fallbackUserId: string) {
  if (Array.isArray(value)) {
    const ids = value.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  if (value && typeof value === "object" && "ids" in value && Array.isArray((value as { ids?: unknown[] }).ids)) {
    const ids = (value as { ids: unknown[] }).ids.filter((v): v is string => typeof v === "string" && v.length > 0);
    return ids.length ? ids : [fallbackUserId];
  }
  return [fallbackUserId];
}

// 5-Digit Unique Reference Engine (Collisions-Safe)
async function generateUniqueInteracRef(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed easily confused characters (I, O, 0, 1)
  let baseToken = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    baseToken = Array.from({ length: 5 }, () => chars[crypto.randomInt(chars.length)]).join("");
    const fullToken = `PLX-${baseToken}`;

    // Verify token availability inside Supabase
    const existing = await prisma.booking.findUnique({
      where: { interacRef: fullToken },
    });

    if (!existing) {
      isUnique = true;
      return fullToken;
    }
    attempts++;
  }
  throw new Error("Failed to allocate a unique payment reference token string safely.");
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip, 10, 60_000)) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez réessayer dans une minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { eventTypeId, email, name, startTime, endTime, paymentMethod = "INTERAC", quantity = 1 } = body; // Added quantity with default

    // 1. Initial Validation Gates
    if (!eventTypeId || !email || !name || !startTime || !endTime) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    // 2. Fetch baseline event configurations
    let eventType: any = null;
    try {
      eventType = await prisma.eventType.findUnique({
        where: { id: eventTypeId },
        select: {
          id: true,
          userId: true,
          price: true,
          minNotice: true,
          bufferBefore: true,
          bufferAfter: true,
          schedulingType: true,
          teamMembers: true,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2022") throw error;

      eventType = await prisma.eventType.findUnique({
        where: { id: eventTypeId },
        select: {
          id: true,
          userId: true,
          price: true,
          minNotice: true,
          bufferBefore: true,
          bufferAfter: true,
        },
      });

      if (eventType) {
        eventType = {
          ...eventType,
          schedulingType: "individual",
          teamMembers: [eventType.userId],
        };
      }
    }

    if (!eventType) {
      return NextResponse.json({ error: "Type d'événement introuvable" }, { status: 404 });
    }

    const slotStart = new Date(startTime);
    const slotEnd = new Date(endTime);
    if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime()) || slotEnd <= slotStart) {
      return NextResponse.json({ error: "Plage horaire invalide" }, { status: 400 });
    }

    const minNoticeMs = (eventType.minNotice || 0) * 60 * 1000;
    if (slotStart.getTime() < Date.now() + minNoticeMs) {
      return NextResponse.json({ error: "Ce créneau est trop proche selon le délai minimum" }, { status: 409 });
    }

    const schedulingType = normalizeSchedulingType(eventType.schedulingType);
    const teamIds = (schedulingType === "round_robin" || schedulingType === "collective" || schedulingType === "pooled")
      ? normalizeTeamMembers(eventType.teamMembers, eventType.userId)
      : [eventType.userId];

    const checkStart = new Date(slotStart.getTime() - (eventType.bufferBefore || 0) * 60000);
    const checkEnd = new Date(slotEnd.getTime() + (eventType.bufferAfter || 0) * 60000);

    const conflicting = await prisma.booking.findMany({
      where: {
        userId: { in: teamIds },
        status: { notIn: ["cancelled", "CANCELLED"] },
        startTime: { lt: checkEnd },
        endTime: { gt: checkStart },
      },
      select: { userId: true },
    });
    const conflictedHostIds = new Set(conflicting.map((b) => b.userId));

    let assignedUserId = eventType.userId;
    if (schedulingType === "collective") {
      if (conflictedHostIds.size > 0) {
        return NextResponse.json({ error: "Ce créneau n'est pas disponible pour toute l'équipe" }, { status: 409 });
      }
    } else if (schedulingType === "round_robin" || schedulingType === "pooled") {
      const availableHosts = teamIds.filter((id) => !conflictedHostIds.has(id));
      if (!availableHosts.length) {
        return NextResponse.json({ error: "Ce créneau n'est plus disponible" }, { status: 409 });
      }

      const recentWindowStart = new Date(slotStart.getTime() - 86400000);
      const recentLoads = await prisma.booking.findMany({
        where: {
          userId: { in: availableHosts },
          status: { notIn: ["cancelled", "CANCELLED"] },
          startTime: { gte: recentWindowStart },
        },
        select: { userId: true },
      });
      const load: Record<string, number> = {};
      for (const id of availableHosts) load[id] = 0;
      for (const b of recentLoads) load[b.userId] = (load[b.userId] || 0) + 1;
      assignedUserId = availableHosts.reduce((a, b) => (load[a] ?? 0) <= (load[b] ?? 0) ? a : b);
    } else if (conflictedHostIds.has(eventType.userId)) {
      return NextResponse.json({ error: "Ce créneau n'est plus disponible" }, { status: 409 });
    }

    // 3. The Quebec Tax Engine Framework (TPS/TVQ)
    const basePrice = (eventType.price || 0) * quantity; // Multiply by quantity
    const tpsRate = 0.05;       // Federal GST
    const tvqRate = 0.09975;    // Quebec QST (calculated directly on the base price as per modern rules)

    const tpsAmount = parseFloat((basePrice * tpsRate).toFixed(2));
    const tvqAmount = parseFloat((basePrice * tvqRate).toFixed(2));
    const finalInvoiceTotal = parseFloat((basePrice + tpsAmount + tvqAmount).toFixed(2));

    // 4. Conditional Token Dynamic Generation Flow
    let interacReferenceString: string | null = null;
    if (paymentMethod === "INTERAC") {
      interacReferenceString = await generateUniqueInteracRef();
    }

    // 5. Atomic Upsert & Record Creation Pipeline
    const newBooking = await prisma.$transaction(async (tx) => {
      // Find or create the target attendee profile cleanly
      const attendee = await tx.attendee.upsert({
        where: { email: email.toLowerCase().trim() },
        update: { name },
        create: {
          email: email.toLowerCase().trim(),
          name,
          locale: "fr" // Default to French baseline for full Bill 96 alignment
        },
      });

      // Commit core booking node with pricing, taxes, and security tokens
      const booking = await tx.booking.create({
        data: {
          attendeeId: attendee.id,
          eventTypeId: eventType.id,
          userId: assignedUserId,
          guestName: name,
          guestEmail: email.toLowerCase().trim(),
          guestNotes: body.notes || null,
          startTime: slotStart,
          endTime: slotEnd,
          status: "PENDING",
          paymentMethod: paymentMethod,
          paymentStatus: paymentMethod === "INTERAC" ? "UNPAID" : "PAID", // Stripe clears auto, Interac waits for hook
          interacRef: interacReferenceString,
          paid: paymentMethod !== "INTERAC",
        },
        include: {
          attendee: true,
          eventType: true,
        },
      });

      // Append Law 25 Audit Tracking Node directly into the transaction batch
      await tx.auditLog.create({
        data: {
          bookingId: booking.id,
          action: "BOOKING_CREATED_INTENT",
          actor: "ATTENDEE",
          ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });

      return booking;
    });

    // 6. Return payload including calculated financial distribution
    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
      cancelToken: newBooking.cancelToken,
      interacRef: newBooking.interacRef,
      financials: {
        basePrice,
        tps: tpsAmount,
        tvq: tvqAmount,
        total: finalInvoiceTotal,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Booking generation error context:", error);
    return NextResponse.json({ error: "Erreur interne du serveur de réservation" }, { status: 500 });
  }
}
