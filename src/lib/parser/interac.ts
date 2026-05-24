
export interface InteracNotificationPayload {
  referenceNumber: string; // The PLX-XXXXX or alphanumeric identity anchor
  amountInCents: number;   // Stored as integer to enforce absolute precision
  senderEmail?: string;
  senderName?: string;
}

/**
 * High-precision extraction utility for parsing raw Interac e-Transfer notification bodies.
 * Integrated with the 3/3 validated Red-Team regex matrix.
 */
export function parseInteracEmail(rawBody: string): InteracNotificationPayload | null {
  if (!rawBody) return null;

  try {
    // 1. Reference Number Isolation (Matches standard 8-character Interac patterns or custom PLX tokens)
    // Focuses on the PLX-xxxxx pattern validated during red-teaming
    const refRegex = /(?:Ref|Reference|Message|Code)\s*(?:Number|#|:)?\s*([A-Z0-9-]{6,12})/i;
    const refMatch = rawBody.match(refRegex);
    if (!refMatch) {
      console.warn("[Parser Warning]: Failed to isolate Interac Reference Number token.");
      return null;
    }
    const referenceNumber = refMatch[1].toUpperCase();

    // 2. Financial Amount Extraction (Dual-Anchor Matrix: $172.46 or 172,46 $)
    // This handles both English and French-Canadian formats
    const amountRegex = /(?:(?:Montant|Amount)[:\s]*\$?\s*|Virement Interac de\s*|[:\s]\$)(\d+[\s,.]\d{2})|(\d+[\s,.]\d{2})\s*\$/i;
    const amountMatch = rawBody.match(amountRegex);
    if (!amountMatch) {
      console.warn("[Parser Warning]: Failed to isolate transaction currency value.");
      return null;
    }

    // Extract the capture group that actually hit (prefix or suffix matches)
    const rawNumStr = (amountMatch[1] || amountMatch[2]).replace(/\s/g, "").replace(/,/g, ".");
    const amountInCents = Math.round(parseFloat(rawNumStr) * 100);

    // 3. Optional Metadata Scraping (Sender attributes)
    let senderName: string | undefined;
    const senderNameRegex = /(?:from|de)\s+([^.\n:]+?)\s+(?:sent|vous)/i;
    const senderMatch = rawBody.match(senderNameRegex);
    if (senderMatch) {
      senderName = senderMatch[1].trim();
    }

    return {
      referenceNumber,
      amountInCents,
      senderName
    };
  } catch (error) {
    console.error("[Parser Critical Failure]: Error executing text extraction engine:", error);
    return null;
  }
}
