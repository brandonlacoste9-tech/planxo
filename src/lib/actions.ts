
"use server";

import { PrismaClient } from '@prisma/client';
import { syncOutlookDelta } from '@/lib/outlook/sync';

const prisma = new PrismaClient();

interface DashboardMetrics {
  recoveredRevenueCents: number;
  pendingLeakingCount: number;
  lastSync: string;
  deltaStatus: string;
}

/**
 * Fetches real-time dashboard metrics from Supabase.
 * Uses service role for system-wide aggregates, bypassing user RLS for global views.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // For simplicity, directly accessing booking data. 
  // In a real app, 'totalAmountInCents' would be a calculated/cached field or derived from EventType.price + taxes.
  const paidBookings = await prisma.booking.findMany({
    where: { paymentStatus: 'PAID' },
    select: { eventType: { select: { price: true } } }
  });

  let recoveredRevenueCents = 0;
  for (const booking of paidBookings) {
    recoveredRevenueCents += booking.eventType?.price || 0;
  }

  const pendingBookingsCount = await prisma.booking.count({
    where: { paymentStatus: 'UNPAID' }
  });

  const outlookAccount = await prisma.outlookAccount.findFirst({
    // Assuming PRIMARY_OUTLOOK_ACCOUNT_ID is set or we get the first one for simplicity
    where: { id: process.env.PRIMARY_OUTLOOK_ACCOUNT_ID || undefined }
  });

  let lastSync = "N/A";
  let deltaStatus = "Inactive";

  if (outlookAccount) {
    lastSync = outlookAccount.deltaLinkUpdatedAt ? new Date(outlookAccount.deltaLinkUpdatedAt).toLocaleString() : "Never Synced";
    deltaStatus = outlookAccount.nextDeltaLink ? "Active Anchor Saved" : "No Delta Link";
  }

  return {
    recoveredRevenueCents,
    pendingLeakingCount: pendingBookingsCount,
    lastSync,
    deltaStatus,
  };
}

/**
 * Triggers a manual synchronization for the primary Outlook account.
 * This directly invokes the delta sync engine.
 */
export async function triggerManualSyncAction() {
  // In a real application, the outlookAccountId would come from the user's session
  // For this context, we use the PRIMARY_OUTLOOK_ACCOUNT_ID from env
  const outlookAccountId = process.env.PRIMARY_OUTLOOK_ACCOUNT_ID;

  if (!outlookAccountId) {
    throw new Error("PRIMARY_OUTLOOK_ACCOUNT_ID is not configured for manual sync trigger.");
  }

  try {
    console.log(`[Dashboard Action]: Triggering manual Outlook sync for account ${outlookAccountId}...`);
    const result = await syncOutlookDelta(outlookAccountId);
    console.log(`[Dashboard Action]: Manual sync completed. Upserted: ${result.upsertedCount}, Deleted: ${result.deletedCount}`);
    return { success: true, message: `Sync completed. Upserted: ${result.upsertedCount}, Deleted: ${result.deletedCount}` };
  } catch (error: any) {
    console.error("[Dashboard Action Error]: Manual sync failed:", error);
    return { success: false, message: error.message || "Failed to trigger manual sync." };
  }
}
