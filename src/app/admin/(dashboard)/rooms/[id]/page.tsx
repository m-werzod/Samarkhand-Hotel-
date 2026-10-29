import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { DeleteRoomButton } from '@/components/admin/delete-room-button';
import { RoomForm } from '@/components/admin/room-form';
import { Button } from '@/components/ui/button';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function EditRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const identity = await requireRole('editor');
  const { id } = await params;

  const store = getStore();
  const room = await store.getRoomById(id);
  if (!room) notFound();

  const [amenities, roomMedia, amenityMedia, settings] = await Promise.all([
    store.listAmenities(),
    store.listMedia({ category: 'rooms' }),
    store.listMedia({ category: 'amenities' }),
    store.getHotelSettings(),
  ]);

  return (
    <>
      <AdminPageHeader
        title={room.name}
        description={`Yaratilgan: ${new Date(room.createdAt).toLocaleDateString('uz-UZ')} · Oxirgi oʻzgarish: ${new Date(room.updatedAt).toLocaleDateString('uz-UZ')}`}
        actions={
          <>
            {room.status === 'published' ? (
              <Button asChild variant="outline" size="md">
                <Link href={`/rooms/${room.slug}`} target="_blank">
                  <ExternalLink aria-hidden="true" />
                  Saytda koʻrish
                </Link>
              </Button>
            ) : null}
            {identity.role === 'admin' ? (
              <DeleteRoomButton roomId={room.id} roomName={room.name} />
            ) : null}
          </>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <RoomForm
          room={room}
          amenities={amenities}
          media={[...roomMedia, ...amenityMedia]}
          defaultCurrency={settings.currency}
        />
      </div>
    </>
  );
}
