
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseInteracEmail } from '@/lib/parser/interac';

// Secret validation token to prevent unauthorized vector spraying
const WEBHOOK_SIGNING_SECRET = process.env.INTERAC_WEBHOOK_SECRET;

export async function POST(request: Request) {
  try {
    // 1. Gateway Security Boundary
    const { searchParams } = new URL(request.url);
    const signature = searchParams.get('secret');
    
    if (!WEBHOOK_SIGNING_SECRET || signature !== WEBHOOK_SIGNING_SECRET) {
      return NextResponse.json({ error: "Unauthorized access vector locked down." }, { status: 401 });
    }

    const jsonPayload = await request.json();
    const rawEmailBody = jsonPayload.body || jsonPayload.text;

    if (!rawEmailBody) {
      return NextResponse.json({ error: "Malformed payload: Missing email body context." }, { status: 400 });
    }

    // 2. Extract Data Matrix
    const paymentMetrics = parseInteracEmail(rawEmailBody);
    if (!paymentMetrics) {
      return NextResponse.json({ error: "Payload rejected: No verifiable Interac data structures found." }, { status: 422 });
    }

    const { referenceNumber, amountInCents } = paymentMetrics;

    // 3. Atomic Reconciliation & Auditing Transaction Block
    const stabilizationResult = await prisma.$transaction(async (tx) => {
      
      // Locate matching booking targeting the explicit token reference string (interacRef in our schema)
      const targetBooking = await tx.booking.findUnique({
        where: { interacRef: referenceNumber }
      });

      if (!targetBooking) {
        throw new Error(`[Reconciliation Abort]: No booking match found for token: ${referenceNumber}`);
      }

      if (targetBooking.paymentStatus === 'PAID') {
        return { success: true, message: "Transaction historical lock active. State already verified as PAID." };
      }

      // We use a simple check here; in production, 
      // we would compare against the EventType.price * 100 + taxes logic
      // For now, we validate that it's not zero.
      if (amountInCents <= 0) {
        throw new Error(`[Reconciliation Abort]: Invalid amount detected: ${amountInCents} cents.`);
      }

      // Execute State Transition: Booking -> PAID
      const updatedBooking = await tx.booking.update({
        where: { id: targetBooking.id },
        data: { 
          paymentStatus: 'PAID',
          paid: true 
        }
      });

      // Write Law 25 Compliant Privacy & Audit Trail Event Commit
      await tx.auditLog.create({
        data: {
          bookingId: updatedBooking.id,
          action: 'BOOKING_PAID_AUTOMATIC_RECONCILIATION',
          actor: 'SYSTEM_INTERAC_PARSER_AGENT',
          ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
          // Metadata handling depends on the specific AuditLog schema
        },
      });

      return { success: true, bookingId: updatedBooking.id };
    });

    return NextResponse.json({ status: "SUCCESS", ledgerUpdated: stabilizationResult.success });

  } catch (error: any) {
    console.error("[Gateway Transactional Failure]:", error.message || error);
    return NextResponse.json({ 
      status: "REJECTED", 
      reason: error.message || "Internal transaction isolation collapse." 
    }, { status: 500 });
  }
}
