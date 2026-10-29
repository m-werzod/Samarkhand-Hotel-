import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { CampaignForm } from '@/components/admin/campaign-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole('editor');
  const { id } = await params;

  const store = getStore();
  const campaign = await store.getCampaignById(id);
  if (!campaign) notFound();

  const [media, offers, rooms] = await Promise.all([
    store.listMedia({ type: 'image' }),
    store.listOffers(),
    store.listRooms({ statuses: ['published'] }),
  ]);

  return (
    <>
      <AdminPageHeader
        title={campaign.title ?? 'Matnsiz slayd'}
        description="Oʻzgarishlar saqlangandan soʻng saytda darhol aks etadi."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <CampaignForm campaign={campaign} media={media} offers={offers} rooms={rooms} />
      </div>
    </>
  );
}
