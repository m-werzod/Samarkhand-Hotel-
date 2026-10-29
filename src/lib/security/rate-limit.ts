import 'server-only';

/**
 * In-process rate limiting.
 *
 * Scope and honesty about it: this is a fixed-window counter held in the Node
 * process. It stops casual abuse and accidental double submits, and it is
 * what a single-instance deployment needs. It does NOT coordinate across
 * serverless instances, so a determined attacker spread across many cold
 * starts gets a higher effective limit.
 *
 * Production hardening is a documented launch item — put Supabase, Upstash or
 * the platform's own WAF in front of it. See docs/SECURITY.md.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalForLimiter = globalThis as unknown as {
  __samarkhandRateBuckets?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  globalForLimiter.__samarkhandRateBuckets ??= new Map();
  return globalForLimiter.__samarkhandRateBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const store = buckets();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    // Opportunistic sweep so the map cannot grow without bound.
    if (store.size > 5000) sweep(store, now);
    return {
      allowed: true,
      remaining: options.limit - 1,
      retryAfter: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  const allowed = existing.count <= options.limit;
  return {
    allowed,
    remaining: Math.max(options.limit - existing.count, 0),
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
  };
}

function sweep(store: Map<string, Bucket>, now: number): void {
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

/**
 * Best-effort client identity for rate limiting.
 *
 * Trusts `x-forwarded-for` only because Vercel sets it at the edge and
 * strips any client-supplied value. On another host that guarantee has to be
 * re-established before this is meaningful.
 */
export function clientKey(headers: Headers, prefix: string): string {
  const forwarded = headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

/** Limits tuned per endpoint. */
export const RATE_LIMITS = {
  bookingInquiry: { limit: 5, windowMs: 10 * 60 * 1000 },
  contactForm: { limit: 5, windowMs: 10 * 60 * 1000 },
  adminLogin: { limit: 8, windowMs: 15 * 60 * 1000 },
  analytics: { limit: 120, windowMs: 60 * 1000 },
} as const;
