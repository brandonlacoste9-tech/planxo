
import { PrismaClient } from '@prisma/client';
import { getLeakingBookings } from '../src/lib/swarm/recovery';
import { executeRecoveryMailSkill } from '../src/lib/swarm/skills/sendRecoveryMail';

const prisma = new PrismaClient();

async function runRecoverySwarm() {
  console.log(`[Swarm Controller]: Initializing ledger scan at ${new Date().toISOString()}...`);
  
  const OUTLOOK_ACCOUNT_ID = process.env.PRIMARY_OUTLOOK_ACCOUNT_ID;
  
  if (!OUTLOOK_ACCOUNT_ID) {
    console.error("[Swarm Controller Critical]: PRIMARY_OUTLOOK_ACCOUNT_ID environment variable is missing.");
    process.exit(1);
  }

  try {
    const targets = await getLeakingBookings();

    if (targets.length === 0) {
      console.log("[Swarm Controller]: Scan complete. Zero uncollateralized leaking bookings detected.");
      process.exit(0);
    }

    console.log(`[Swarm Controller]: Identified ${targets.length} target(s) for revenue recovery action.`);

    for (const booking of targets) {
      // Use interacRef for reference token mapping
      const refToken = booking.interacRef || 'N/A';
      const amountInDollars = (booking.totalAmountCents / 100).toFixed(2);
      
      console.log(`[Swarm Target]: Processing context for booking ${refToken} (${booking.customerEmail})`);
      
      try {
        const success = await executeRecoveryMailSkill({
          outlookAccountId: OUTLOOK_ACCOUNT_ID,
          customerEmail: booking.customerEmail,
          customerName: booking.customerName,
          referenceToken: refToken,
          amountInDollars: amountInDollars
        });

        if (success) {
          console.log(`[Swarm Success]: Recovery vector delivered to ${booking.customerEmail} for token ${refToken}.`);
        }
      } catch (workerError: any) {
        console.error(`[Swarm Worker Failure]: Execution collapsed for token ${refToken}:`, workerError.message || workerError);
      }
    }

    console.log("[Swarm Controller]: All recovery tasks handled. Exiting execution context smoothly.");
    process.exit(0);

  } catch (error: any) {
    console.error("[Swarm Controller Fatal Error]: Failed to execute main scanning thread:", error.message || error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRecoverySwarm();
