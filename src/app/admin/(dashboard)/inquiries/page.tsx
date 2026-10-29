import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { InquiryList } from '@/components/admin/inquiry-list';
import { TablePagination } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { INQUIRY_STATUSES, type InquiryStatus } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'Yangi',
  in_progress: 'Koʻrib chiqilmoqda',
  resolved: 'Hal qilingan',
  spam: 'Spam',
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole('viewer');
  const params = await searchParams;

  const read = (key: string): string => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? '';
  };

  const statusParam = read('status');
  const status = INQUIRY_STATUSES.includes(statusParam as InquiryStatus)
    ? (statusParam as InquiryStatus)
    : null;
  const offset = Math.max(Number.parseInt(read('offset'), 10) || 0, 0);
  const focus = read('focus') || undefined;

  const result = await getStore().listInquiries({
    statuses: status ? [status] : undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const buildHref = (nextOffset: number): string => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (nextOffset > 0) query.set('offset', String(nextOffset));
    const qs = query.toString();
    return qs ? `/admin/inquiries?${qs}` : '/admin/inquiries';
  };

  return (
    <>
      <AdminPageHeader
        title="Xabarlar"
        description="Aloqa formasi orqali yuborilgan xabarlar."
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="scroll-rail mb-5 gap-2">
          <FilterLink href="/admin/inquiries" label="Barchasi" active={!status} />
          {INQUIRY_STATUSES.map((value) => (
            <FilterLink
              key={value}
              href={`/admin/inquiries?status=${value}`}
              label={STATUS_LABELS[value]}
              active={status === value}
            />
          ))}
        </div>

        <InquiryList inquiries={result.items} focusId={focus} />

        <TablePagination
          total={result.total}
          offset={offset}
          limit={PAGE_SIZE}
          buildHref={buildHref}
        />
      </div>
    </>
  );
}

function FilterLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Button
      asChild
      variant={active ? 'primary' : 'secondary'}
      size="sm"
      className={cn('whitespace-nowrap rounded-full', active && 'pointer-events-none')}
    >
      <Link href={href} aria-current={active ? 'page' : undefined}>
        {label}
      </Link>
    </Button>
  );
}
