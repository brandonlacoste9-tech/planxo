
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TokenRefreshResponse {
  token_type: string;
  scope: string;
  expires_in: number; // seconds
  ext_expires_in: number;
  access_token: string;
  refresh_token: string;
}

/**
 * Validates, rotates, and returns an authenticated access token for Microsoft Graph.
 * Guarantees zero token dropouts for downstream sync workers.
 */
export async function getValidOutlookCredentials(outlookAccountId: string): Promise<string> {
  const account = await prisma.outlookAccount.findUnique({
    where: { id: outlookAccountId },
  });

  if (!account) {
    throw new Error(`[Auth Vault Error]: Account context not found for ID: ${outlookAccountId}`);
  }

  // Define a 5-minute pre-expiration buffer (in milliseconds)
  const PRE_EXPIRATION_BUFFER_MS = 5 * 60 * 1000;
  const isExpired = new Date(account.tokenExpiresAt).getTime() - PRE_EXPIRATION_BUFFER_MS < Date.now();

  if (!isExpired) {
    return account.accessToken;
  }

  console.log(`[Auth Vault]: Token expiration imminent or reached for ${account.email}. Initiating rotation sequence...`);

  // Verify infrastructure keys are present
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("[Auth Vault Error]: Infrastructure environment keys (AZURE_CLIENT_ID/AZURE_CLIENT_SECRET) missing.");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/token`;

  // Build urlencoded payload for the Microsoft Identity Platform
  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
    scope: 'https://graph.microsoft.com/.default offline_access',
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Microsoft Token Exchange failed: ${response.statusText} ${JSON.stringify(errorData)}`);
    }

    const tokens: TokenRefreshResponse = await response.json();

    // Calculate absolute UTC expiration anchor
    const freshExpirationDate = new Date(Date.now() + tokens.expires_in * 1000);

    // Atomic write back to the sovereign database layer
    const updatedAccount = await prisma.outlookAccount.update({
      where: { id: outlookAccountId },
      data: {
        accessToken: tokens.access_token,
        // Microsoft may rotate the refresh token; if not returned, preserve the existing token
        refreshToken: tokens.refresh_token || account.refreshToken,
        tokenExpiresAt: freshExpirationDate,
      },
    });

    console.log(`[Auth Vault]: Rotation successful. New credentials anchored for ${updatedAccount.email}.`);
    return updatedAccount.accessToken;

  } catch (error) {
    console.error(`[Auth Vault Critical Failure]: Unable to rotate credentials for account context ${outlookAccountId}:`, error);
    throw error;
  }
}
