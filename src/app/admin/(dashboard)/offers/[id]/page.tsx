import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { OfferForm } from '@/components/admin/offer-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('editor');
  const { id } = await params;

  const store = getStore();
  const offer = await store.getOfferById(id);
  if (!offer) notFound();

  const [rooms, settings] = await Promise.all([
    store.listRooms(),
    store.getHotelSettings(),
  ]);

  return (
    <>
      <AdminPageHeader title={offer.name} description="Taklif shartlarini tahrirlash." />
      <div className="p-4 sm:p-6 lg:p-8">
        <OfferForm offer={offer} rooms={rooms} currency={settings.currency} />
      </div>
    </>
  );
}
