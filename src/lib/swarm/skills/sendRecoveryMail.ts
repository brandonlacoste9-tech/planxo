
import { getValidOutlookCredentials } from '../../outlook/auth';

interface RecoveryMailPayload {
  outlookAccountId: string;
  customerEmail: string;
  customerName: string;
  referenceToken: string;
  amountInDollars: string;
}

/**
 * Core execution skill for a spawned worker. 
 * Fires a targeted recovery vector via Microsoft Graph.
 */
export async function executeRecoveryMailSkill(payload: RecoveryMailPayload): Promise<boolean> {
  const { outlookAccountId, customerEmail, customerName, referenceToken, amountInDollars } = payload;
  
  const accessToken = await getValidOutlookCredentials(outlookAccountId);

  const emailBody = {
    message: {
      subject: `Action Required: Complete your booking [${referenceToken}]`,
      body: {
        contentType: "HTML",
        content: `
          <p>Hi ${customerName},</p>
          <p>We noticed your booking isn't finalized yet. To lock in your window, please complete the Interac e-Transfer of <strong style="color: #B45309;">$${amountInDollars}</strong> to our payment gateway.</p>
          <p><strong style="color: #B45309;">Important:</strong> You must include your exact tracking token in the message section: <strong style="font-family: monospace;">${referenceToken}</strong></p>
          <p>Once received, our autonomous ledger will instantly confirm your reservation.</p>
        `
      },
      toRecipients: [
        { emailAddress: { address: customerEmail } }
      ]
    },
    saveToSentItems: "true"
  };

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailBody)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`[Swarm Skill Failure]: Graph mail delivery rejected: ${JSON.stringify(err)}`);
  }

  return true;
}
