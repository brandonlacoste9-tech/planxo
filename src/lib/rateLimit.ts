const ipHits = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple in-process rate limiter.
 * Returns true if the request should be blocked.
 */
export function isRateLimited(ip: string, maxRequests = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);

  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (entry.count >= maxRequests) return true;
  entry.count++;
  return false;
}
