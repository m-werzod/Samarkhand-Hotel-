'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import { deleteRoomAction } from '@/app/admin/actions/content';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

/**
 * Deleting a room is destructive and irreversible, so it is always behind a
 * confirmation that names the room. The server additionally refuses when
 * active bookings reference it — the dialog is the courtesy, the server check
 * is the guarantee.
 */
export function DeleteRoomButton({
  roomId,
  roomName,
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    const result = await deleteRoomAction(roomId);
    setPending(false);
    setOpen(false);

    if (!result.ok) {
      push({ tone: 'error', title: result.message, duration: 10000 });
      return;
    }

    push({ tone: 'success', title: result.message });
    router.push('/admin/rooms');
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" size="md" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Oʻchirish
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`"${roomName}" oʻchirilsinmi?`}
        description="Bu amalni qaytarib boʻlmaydi. Agar xonani vaqtincha yashirmoqchi boʻlsangiz, uni arxivlang yoki qoralamaga oʻtkazing."
        confirmLabel="Ha, oʻchirilsin"
        onConfirm={confirm}
        pending={pending}
      />
    </>
  );
}
