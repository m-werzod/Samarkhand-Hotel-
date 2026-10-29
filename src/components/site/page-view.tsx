'use client';

import * as React from 'react';

import { trackEvent } from '@/lib/analytics/client';
import type { AnalyticsEventType } from '@/lib/domain/types';

/**
 * Fires one page-view event on mount.
 *
 * Rendered as a zero-output component so a Server Component page can record
 * a view without becoming a Client Component itself.
 */
export function PageView({
  event,
  roomId,
  metadata,
}: {
  event: AnalyticsEventType;
  roomId?: string;
  metadata?: Record<string, string | number | boolean>;
}) {
  React.useEffect(() => {
    trackEvent({
      type: event,
      roomId: roomId ?? null,
      metadata: metadata ?? {},
      dedupeKey: `${event}:${roomId ?? 'page'}`,
    });
    // `metadata` is a fresh object each render; the dedupe key is what
    // actually governs repeat sends, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, roomId]);

  return null;
}
