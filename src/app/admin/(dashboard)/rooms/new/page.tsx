import { AdminPageHeader } from '@/components/admin/admin-shell';
import { RoomForm } from '@/components/admin/room-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function NewRoomPage() {
  await requireRole('editor');

  const store = getStore();
  const [amenities, media, settings] = await Promise.all([
    store.listAmenities(),
    store.listMedia({ category: 'rooms' }),
    store.getHotelSettings(),
  ]);

  // Room photography lives in the `rooms` and `amenities` categories; showing
  // the whole library here would bury the relevant assets under campaign
  // backdrops.
  const roomMedia = [...media, ...(await store.listMedia({ category: 'amenities' }))];

  return (
    <>
      <AdminPageHeader
        title="Yangi xona"
        description="Xona yaratilgandan soʻng uni qoralama sifatida saqlab, keyin chop etishingiz mumkin."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <RoomForm
          room={null}
          amenities={amenities}
          media={roomMedia}
          defaultCurrency={settings.currency}
        />
      </div>
    </>
  );
}
