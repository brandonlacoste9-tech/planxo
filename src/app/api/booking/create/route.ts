import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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
    const body = await request.json();
    const { eventTypeId, email, name, startTime, endTime, paymentMethod = "INTERAC", quantity = 1 } = body; // Added quantity with default

    // 1. Initial Validation Gates
    if (!eventTypeId || !email || !name || !startTime || !endTime) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    // 2. Fetch baseline event configurations
    const eventType = await prisma.eventType.findUnique({
      where: { id: eventTypeId },
    });

    if (!eventType) {
      return NextResponse.json({ error: "Type d'événement introuvable" }, { status: 404 });
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
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "PENDING",
          paymentMethod: paymentMethod,
          paymentStatus: paymentMethod === "INTERAC" ? "UNPAID" : "PAID", // Stripe clears auto, Interac waits for hook
          interacRef: interacReferenceString,
          amount: basePrice, // Store individual components
          taxAmount: tpsAmount + tvqAmount, // Store total tax
          totalAmount: finalInvoiceTotal, // Store total amount
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
