import Link from 'next/link';
import { BedDouble, Plus } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { DataTable, type Column } from '@/components/admin/data-table';
import { RoomStatusControl } from '@/components/admin/room-status-control';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { formatMoney } from '@/lib/domain/money';
import type { MediaAsset, PublicationStatus, Room } from '@/lib/domain/types';

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

export default async function AdminRoomsPage() {
  await requireRole('viewer');

  const store = getStore();
  const [rooms, mediaList] = await Promise.all([store.listRooms(), store.listMedia()]);
  const media = new Map(mediaList.map((asset) => [asset.id, asset]));

  const columns: Column<Room>[] = [
    {
      key: 'name',
      header: 'Xona',
      render: (room) => (
        <div className="flex items-center gap-3">
          <div className="w-16 shrink-0 overflow-hidden rounded">
            <MediaImage
              asset={firstMedia(room, media)}
              sizes="64px"
              aspect="4 / 3"
            />
          </div>
          <div className="min-w-0">
            <Link
              href={`/admin/rooms/${room.id}`}
              className="font-medium text-chocolate-800 hover:underline"
            >
              {room.name}
            </Link>
            <p className="truncate text-xs text-brown-300">/{room.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'capacity',
      header: 'Sigʻim',
      secondary: true,
      render: (room) => (
        <span className="tabular-nums">
          {room.maxOccupancy} ({room.maxAdults}+{room.maxChildren})
        </span>
      ),
    },
    {
      key: 'inventory',
      header: 'Soni',
      secondary: true,
      align: 'right',
      render: (room) =>
        room.inventoryCount > 0 ? (
          <span className="tabular-nums">{room.inventoryCount}</span>
        ) : (
          <span className="text-brown-300" title="Bandlik tekshirilmaydi">
            —
          </span>
        ),
    },
    {
      key: 'price',
      header: 'Narx / kecha',
      align: 'right',
      render: (room) => (
        <div className="tabular-nums">
          {formatMoney(room.basePrice)}
          {room.isDemoData ? (
            <Badge tone="warning" className="ml-2">
              namuna
            </Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Holat',
      align: 'right',
      render: (room) => <RoomStatusControl room={room} />,
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="Xonalar"
        description="Xona turlarini qoʻshing, narxlarni oʻzgartiring va saytda koʻrinishini boshqaring."
        actions={
          <Button asChild size="md">
            <Link href="/admin/rooms/new">
              <Plus aria-hidden="true" />
              Yangi xona
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <DataTable
          rows={rooms}
          columns={columns}
          getRowKey={(room) => room.id}
          caption="Xonalar roʻyxati"
          renderCard={(room) => (
            <Card tone="plain" className="overflow-hidden">
              <div className="flex gap-3 p-3">
                <div className="w-24 shrink-0 overflow-hidden rounded">
                  <MediaImage
                    asset={firstMedia(room, media)}
                    sizes="96px"
                    aspect="4 / 3"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/rooms/${room.id}`}
                    className="block truncate font-medium text-chocolate-800"
                  >
                    {room.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-brown-300">/{room.slug}</p>
                  <p className="mt-1.5 text-sm tabular-nums text-chocolate-700">
                    {formatMoney(room.basePrice)} · {room.maxOccupancy} mehmon
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[room.status]}>
                      {STATUS_LABEL[room.status]}
                    </Badge>
                    {room.isDemoData ? <Badge tone="warning">namuna</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="border-t border-sand-200 px-3 py-2">
                <RoomStatusControl room={room} />
              </div>
            </Card>
          )}
          empty={
            <EmptyState
              icon={<BedDouble />}
              title="Hali xona qoʻshilmagan"
              description="Birinchi xona turini yarating — u saytda darhol koʻrinadi."
              action={
                <Button asChild>
                  <Link href="/admin/rooms/new">
                    <Plus aria-hidden="true" />
                    Yangi xona
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

function firstMedia(room: Room, media: Map<string, MediaAsset>): MediaAsset | null {
  for (const id of room.mediaIds) {
    const asset = media.get(id);
    if (asset) return asset;
  }
  return null;
}
