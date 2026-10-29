'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { setRoomStatusAction } from '@/app/admin/actions/content';
import { Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type { PublicationStatus, Room } from '@/lib/domain/types';

const STATUS_TONE: Record<PublicationStatus, 'success' | 'warning' | 'neutral'> = {
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
};

const STATUS_LABEL: Record<PublicationStatus, string> = {
  published: 'Chop etilgan',
  draft: 'Qoralama',
  archived: 'Arxiv',
};

/**
 * Publish / unpublish toggle for a room row.
 *
 * Deliberately optimistic-free: the badge only changes once the server has
 * confirmed. An operator who sees "published" needs that to mean the public
 * site is actually serving the room, not that a request is in flight.
 */
export function RoomStatusControl({ room }: { room: Room }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = React.useState(false);

  const published = room.status === 'published';
  const nextStatus: PublicationStatus = published ? 'draft' : 'published';

  async function toggle() {
    setPending(true);
    const result = await setRoomStatusAction(room.id, nextStatus);
    setPending(false);

    if (!result.ok) {
      push({ tone: 'error', title: result.message });
      return;
    }
    push({
      tone: 'success',
      title: nextStatus === 'published' ? 'Saytda chop etildi' : 'Saytdan olib qoʻyildi',
    });
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Badge tone={STATUS_TONE[room.status]}>{STATUS_LABEL[room.status]}</Badge>
      <button
        type="button"
        onClick={toggle}
        disabled={pending || room.status === 'archived'}
        aria-busy={pending || undefined}
        title={
          room.status === 'archived'
            ? 'Arxivlangan xonani tahrirlash sahifasidan tiklang'
            : published
              ? 'Saytdan olib qoʻyish'
              : 'Saytda chop etish'
        }
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-md transition-colors',
          'text-brown-400 hover:bg-sand-200 hover:text-chocolate-800',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : published ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only">
          {published ? `${room.name}: saytdan olib qoʻyish` : `${room.name}: chop etish`}
        </span>
      </button>
    </div>
  );
}
