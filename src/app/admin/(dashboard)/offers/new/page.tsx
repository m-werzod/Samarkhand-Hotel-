import { AdminPageHeader } from '@/components/admin/admin-shell';
import { OfferForm } from '@/components/admin/offer-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function NewOfferPage() {
  await requireRole('editor');

  const store = getStore();
  const [rooms, settings] = await Promise.all([
    store.listRooms(),
    store.getHotelSettings(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Yangi taklif"
        description="Taklif chop etilgandan soʻng mos xonalarning narxlariga avtomatik qoʻllanadi."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <OfferForm offer={null} rooms={rooms} currency={settings.currency} />
      </div>
    </>
  );
}
