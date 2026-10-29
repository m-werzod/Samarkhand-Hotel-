import Link from 'next/link';
import { Plus, Tag } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { DataTable, type Column } from '@/components/admin/data-table';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { formatMoney } from '@/lib/domain/money';
import type { Offer } from '@/lib/domain/types';

const STATUS = {
  published: { tone: 'success' as const, label: 'Chop etilgan' },
  draft: { tone: 'warning' as const, label: 'Qoralama' },
  archived: { tone: 'neutral' as const, label: 'Arxiv' },
};

export default async function AdminOffersPage() {
  await requireRole('viewer');

  const store = getStore();
  const [offers, rooms, settings] = await Promise.all([
    store.listOffers(),
    store.listRooms(),
    store.getHotelSettings(),
  ]);

  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const discountLabel = (offer: Offer): string =>
    offer.discountType === 'percentage'
      ? `${offer.discountValue}%`
      : formatMoney({ amount: offer.discountValue, currency: settings.currency });

  const eligibleLabel = (offer: Offer): string =>
    offer.eligibleRoomIds.length === 0
      ? 'Barcha xonalar'
      : offer.eligibleRoomIds
          .map((id) => roomNames.get(id) ?? id)
          .join(', ');

  const columns: Column<Offer>[] = [
    {
      key: 'name',
      header: 'Taklif',
      render: (offer) => (
        <Link
          href={`/admin/offers/${offer.id}`}
          className="font-medium text-chocolate-800 hover:underline"
        >
          {offer.name}
        </Link>
      ),
    },
    {
      key: 'discount',
      header: 'Chegirma',
      render: (offer) => <span className="tabular-nums">{discountLabel(offer)}</span>,
    },
    {
      key: 'minNights',
      header: 'Min. kecha',
      secondary: true,
      align: 'right',
      render: (offer) => <span className="tabular-nums">{offer.minimumNights}</span>,
    },
    {
      key: 'rooms',
      header: 'Xonalar',
      secondary: true,
      render: (offer) => (
        <span className="text-sm text-brown-400">{eligibleLabel(offer)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      align: 'right',
      render: (offer) => (
        <Badge tone={STATUS[offer.status].tone}>{STATUS[offer.status].label}</Badge>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Takliflar"
        description="Chegirmalar bron soʻrovi yuborilganda avtomatik qoʻllanadi. Bir vaqtda faqat bittasi — eng foydalisi — ishlaydi."
        actions={
          <Button asChild size="md">
            <Link href="/admin/offers/new">
              <Plus aria-hidden="true" />
              Yangi taklif
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <DataTable
          rows={offers}
          columns={columns}
          getRowKey={(offer) => offer.id}
          caption="Takliflar roʻyxati"
          renderCard={(offer) => (
            <Card tone="plain" className="p-4">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/offers/${offer.id}`}
                  className="font-medium text-chocolate-800"
                >
                  {offer.name}
                </Link>
                <Badge tone={STATUS[offer.status].tone}>
                  {STATUS[offer.status].label}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-brown-400">
                {discountLabel(offer)} · min. {offer.minimumNights} kecha
              </p>
              <p className="mt-1 text-xs text-brown-300">{eligibleLabel(offer)}</p>
            </Card>
          )}
          empty={
            <EmptyState
              icon={<Tag />}
              title="Hali taklif yoʻq"
              description="Chegirma yaratsangiz, u xona narxlariga avtomatik qoʻllanadi."
              action={
                <Button asChild>
                  <Link href="/admin/offers/new">
                    <Plus aria-hidden="true" />
                    Yangi taklif
                  </Link>
                </Button>
              }
            />
          }
        />
      </div>
    </>
  );
}
