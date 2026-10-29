'use client';

import type { AnalyticsEventType } from '@/lib/domain/types';

/**
 * Client-side analytics.
 *
 * Design constraints, in order:
 *
 *  1. **Non-identifying.** No cookie, no fingerprint, no IP logging, no user
 *     agent. The only identifier is a random id held in `sessionStorage`,
 *     which dies with the tab and never crosses a device.
 *  2. **Never breaks a page.** Every failure path is swallowed. An analytics
 *     outage must not cost the hotel a booking.
 *  3. **Cheap.** Uses `sendBeacon` where available so events do not hold a
 *     navigation open.
 */

const SESSION_KEY = 'samarkhand.session';
const ENDPOINT = '/api/analytics';

/** Events already sent this page view, to keep impressions deduplicated. */
const sentOnce = new Set<string>();

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private mode or storage disabled: proceed without a session id rather
    // than failing. The server treats the event as anonymous-unbucketed.
    return null;
  }
}

export interface TrackOptions {
  type: AnalyticsEventType;
  roomId?: string | null;
  campaignId?: string | null;
  metadata?: Record<string, string | number | boolean>;
  /** Send at most once per page view, keyed by this string. */
  dedupeKey?: string;
}

export function trackEvent(options: TrackOptions): void {
  if (typeof window === 'undefined') return;

  if (options.dedupeKey) {
    if (sentOnce.has(options.dedupeKey)) return;
    sentOnce.add(options.dedupeKey);
  }

  const sessionId = getSessionId();
  if (!sessionId) return;

  const payload = JSON.stringify({
    type: options.type,
    sessionId,
    roomId: options.roomId ?? null,
    campaignId: options.campaignId ?? null,
    metadata: options.metadata ?? {},
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      body: payload,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Deliberately silent.
  }
}

/** Clears the per-page-view dedupe set. Called on client-side navigation. */
export function resetTrackingDedupe(): void {
  sentOnce.clear();
}
