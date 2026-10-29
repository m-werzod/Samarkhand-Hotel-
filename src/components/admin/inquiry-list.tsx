'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Save } from 'lucide-react';

import { updateInquiryAction } from '@/app/admin/actions/content';
import { Button } from '@/components/ui/button';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { formatPhoneForDisplay, toTelHref } from '@/lib/domain/contact';
import { INQUIRY_STATUSES, type ContactInquiry, type InquiryStatus } from '@/lib/domain/types';

const STATUS_META: Record<
  InquiryStatus,
  { label: string; tone: 'warning' | 'info' | 'success' | 'neutral' }
> = {
  new: { label: 'Yangi', tone: 'warning' },
  in_progress: { label: 'Koʻrib chiqilmoqda', tone: 'info' },
  resolved: { label: 'Hal qilingan', tone: 'success' },
  spam: { label: 'Spam', tone: 'neutral' },
};

export function InquiryList({
  inquiries,
  focusId,
}: {
  inquiries: ContactInquiry[];
  focusId?: string;
}) {
  if (inquiries.length === 0) {
    return (
      <EmptyState
        icon={<Mail />}
        title="Xabar yoʻq"
        description="Mehmon aloqa formasi orqali yozganda, xabar shu yerda koʻrinadi."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id}>
          <InquiryCard inquiry={inquiry} highlighted={inquiry.id === focusId} />
        </li>
      ))}
    </ul>
  );
}

function InquiryCard({
  inquiry,
  highlighted,
}: {
  inquiry: ContactInquiry;
  highlighted: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [status, setStatus] = React.useState<InquiryStatus>(inquiry.status);
  const [notes, setNotes] = React.useState(inquiry.internalNotes ?? '');
  const [pending, setPending] = React.useState(false);

  const dirty = status !== inquiry.status || notes !== (inquiry.internalNotes ?? '');

  async function save() {
    setPending(true);
    const result = await updateInquiryAction({
      inquiryId: inquiry.id,
      status,
      internalNotes: notes,
    });
    setPending(false);

    push({ tone: result.ok ? 'success' : 'error', title: result.message });
    if (result.ok) router.refresh();
  }

  return (
    <Card
      tone="plain"
      className={highlighted ? 'border-gold-500 ring-2 ring-gold-500/25' : undefined}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg text-chocolate-800">
              {inquiry.subject}
            </h3>
            <p className="mt-0.5 text-sm text-brown-400">
              {inquiry.name} ·{' '}
              {new Date(inquiry.createdAt).toLocaleString('uz-UZ')}
            </p>
          </div>
          <Badge tone={STATUS_META[inquiry.status].tone} size="md">
            {STATUS_META[inquiry.status].label}
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <a
            href={`mailto:${inquiry.email}`}
            className="inline-flex items-center gap-1.5 text-brown-500 hover:underline"
          >
            <Mail className="size-3.5" aria-hidden="true" />
            {inquiry.email}
          </a>
          {inquiry.phone ? (
            <a
              href={toTelHref(inquiry.phone)}
              className="inline-flex items-center gap-1.5 text-brown-500 hover:underline"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              {formatPhoneForDisplay(inquiry.phone)}
            </a>
          ) : null}
        </div>

        <p className="mt-4 whitespace-pre-wrap rounded-md bg-sand-200/60 p-4 text-sm leading-relaxed text-chocolate-700">
          {inquiry.message}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[12rem_1fr]">
          <Field id={`inq-status-${inquiry.id}`} label="Holat">
            {(aria) => (
              <Select
                {...aria}
                value={status}
                onChange={(event) => setStatus(event.target.value as InquiryStatus)}
              >
                {INQUIRY_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            id={`inq-notes-${inquiry.id}`}
            label="Ichki izoh"
            hint="Faqat xodimlar koʻradi."
          >
            {(aria) => (
              <Textarea
                {...aria}
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            )}
          </Field>
        </div>

        <Button
          size="md"
          className="mt-3"
          disabled={!dirty}
          loading={pending}
          loadingLabel="Saqlanmoqda…"
          onClick={save}
        >
          <Save aria-hidden="true" />
          Saqlash
        </Button>
      </div>
    </Card>
  );
}
