import { NextResponse } from 'next/server';

import { getStore } from '@/lib/data';
import { analyticsEventSchema } from '@/lib/validation/schemas';
import { RATE_LIMITS, clientKey, rateLimit } from '@/lib/security/rate-limit';

/**
 * Analytics ingestion.
 *
 * Deliberately minimal. It validates against the known event vocabulary,
 * rate limits by client, and writes a row. It never reads a cookie, never
 * logs an IP beyond the rate-limit key held in memory, and never echoes the
 * payload back.
 *
 * Every failure returns 204. A tracking error must be invisible to the
 * visitor — the page they are reading is the product, this is not.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_CONTENT = new NextResponse(null, { status: 204 });

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const limit = rateLimit(
      clientKey(request.headers, 'analytics'),
      RATE_LIMITS.analytics,
    );
    if (!limit.allowed) return NO_CONTENT;

    const body: unknown = await request.json();
    const parsed = analyticsEventSchema.safeParse(body);
    if (!parsed.success) return NO_CONTENT;

    // The session id is client-generated and untrusted, so it is bounded here
    // as well as in the database policy.
    const rawSession =
      typeof (body as { sessionId?: unknown }).sessionId === 'string'
        ? (body as { sessionId: string }).sessionId
        : '';
    const sessionId = rawSession.replace(/[^a-f0-9]/gi, '').slice(0, 64);
    if (sessionId.length < 8) return NO_CONTENT;

    await getStore().recordAnalyticsEvent({
      type: parsed.data.type,
      sessionId,
      roomId: parsed.data.roomId ?? null,
      campaignId: parsed.data.campaignId ?? null,
      metadata: parsed.data.metadata ?? {},
    });

    return NO_CONTENT;
  } catch {
    return NO_CONTENT;
  }
}
