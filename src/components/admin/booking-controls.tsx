'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, CheckCheck, Save } from 'lucide-react';

import {
  updateBookingNotesAction,
  updateBookingStatusAction,
} from '@/app/admin/actions/content';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { BOOKING_TRANSITIONS } from '@/lib/domain/booking';
import type { Booking, BookingStatus } from '@/lib/domain/types';

const ACTION_META: Record<
  BookingStatus,
  { label: string; icon: React.ElementType; variant: 'primary' | 'danger' | 'secondary'; confirm: string }
> = {
  confirmed: {
    label: 'Tasdiqlash',
    icon: Check,
    variant: 'primary',
    confirm:
      'Bron tasdiqlanadi. Mehmonga bu haqda xabar berishni unutmang — tizim avtomatik email yubormaydi, agar provayder sozlanmagan boʻlsa.',
  },
  cancelled: {
    label: 'Bekor qilish',
    icon: Ban,
    variant: 'danger',
    confirm:
      'Bron bekor qilinadi. Bu holat yakuniy — keyin uni qayta tiklab boʻlmaydi.',
  },
  completed: {
    label: 'Yakunlangan deb belgilash',
    icon: CheckCheck,
    variant: 'secondary',
    confirm:
      'Mehmon kelib ketgan deb belgilanadi. Bu holat yakuniy.',
  },
  pending: {
    label: 'Kutishga qaytarish',
    icon: Check,
    variant: 'secondary',
    confirm: '',
  },
};

/**
 * Status transition controls.
 *
 * Only transitions the state machine permits are offered — a cancelled
 * booking shows no buttons at all rather than buttons that will be rejected.
 * Terminal transitions are confirmed, and the confirmation says what the
 * operator still has to do by hand (telling the guest) rather than implying
 * the system handles it.
 */
export function BookingStatusControls({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { push } = useToast();
  const [target, setTarget] = React.useState<BookingStatus | null>(null);
  const [pending, setPending] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const available = BOOKING_TRANSITIONS[booking.status];

  async function apply(next: BookingStatus) {
    setPending(true);
    const result = await updateBookingStatusAction({
      bookingId: booking.id,
      status: next,
      reason: reason.trim() || undefined,
    });
    setPending(false);
    setTarget(null);
    setReason('');

    if (!result.ok) {
      push({ tone: 'error', title: result.message, duration: 9000 });
      return;
    }
    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  if (available.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-brown-400">
        Bu bron yakuniy holatda — holatini oʻzgartirib boʻlmaydi.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((next) => {
          const meta = ACTION_META[next];
          return (
            <Button
              key={next}
              variant={meta.variant}
              size="md"
              onClick={() => setTarget(next)}
            >
              <meta.icon aria-hidden="true" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setReason('');
          }
        }}
        title={target ? `${ACTION_META[target].label}?` : ''}
        description={target ? ACTION_META[target].confirm : ''}
        confirmLabel={target ? ACTION_META[target].label : ''}
        tone={target === 'cancelled' ? 'danger' : 'primary'}
        pending={pending}
        onConfirm={() => target && apply(target)}
      />
    </>
  );
}

/**
 * Internal notes.
 *
 * Labelled as staff-only right on the field, because the single most
 * damaging mistake here is an operator writing something they believe is
 * private into a field they think the guest sees.
 */
export function BookingNotes({ booking }: { booking: Booking }) {
  const router = useRouter();
  const { push } = useToast();
  const [value, setValue] = React.useState(booking.internalNotes ?? '');
  const [pending, setPending] = React.useState(false);

  const dirty = value !== (booking.internalNotes ?? '');

  async function save() {
    setPending(true);
    const result = await updateBookingNotesAction({
      bookingId: booking.id,
      internalNotes: value,
    });
    setPending(false);

    if (!result.ok) {
      push({ tone: 'error', title: result.message });
      return;
    }
    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  return (
    <Card tone="plain" className="p-5">
      <h2 className="font-display text-lg text-chocolate-800">Ichki izohlar</h2>
      <p className="mt-1 text-xs leading-relaxed text-brown-400">
        Faqat xodimlar koʻradi. Mehmonga hech qachon koʻrsatilmaydi va CSV
        eksportga ham qoʻshilmaydi.
      </p>

      <Field id="booking-notes" label="Izoh" className="mt-4">
        {(aria) => (
          <Textarea
            {...aria}
            rows={5}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Masalan: mehmon kech keladi, transferni tashkil qilish kerak."
          />
        )}
      </Field>

      <Button
        size="md"
        className="mt-3"
        disabled={!dirty}
        loading={pending}
        loadingLabel="Saqlanmoqda…"
        onClick={save}
      >
        <Save aria-hidden="true" />
        Izohni saqlash
      </Button>
    </Card>
  );
}
