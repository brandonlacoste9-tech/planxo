
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LeakingBookingContext {
  id: string;
  interacRef: string;
  customerEmail: string;
  customerName: string;
  totalAmountCents: number;
  createdAt: Date;
}

/**
 * Scans the ledger for uncollateralized PENDING states ripe for recovery.
 * Captures bookings older than 30 minutes but younger than 24 hours.
 */
export async function getLeakingBookings(): Promise<LeakingBookingContext[]> {
  const safetyThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
  const expirationBoundary = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const bookings = await prisma.booking.findMany({
    where: {
      paymentStatus: 'UNPAID',
      createdAt: {
        lte: safetyThreshold,
        gte: expirationBoundary
      }
    },
    select: {
      id: true,
      interacRef: true,
      guestEmail: true,
      guestName: true,
      // We calculate the total amount on the fly since it's derived from EventType.price + taxes
      // In a real-world scenario, we'd have a cachedTotalAmount column.
      createdAt: true
    }
  });

  // For the sake of this loop, we'll assume a fixed price or fetch it from EventType.
  // To keep the swarm fast, we'll map them into a simplified context.
  return bookings.map(b => ({
    id: b.id,
    interacRef: b.interacRef || 'N/A',
    customerEmail: b.guestEmail,
    customerName: b.guestName,
    totalAmountCents: 0, // Resolved per booking in the worker's logic
    createdAt: b.createdAt
  }));
}
