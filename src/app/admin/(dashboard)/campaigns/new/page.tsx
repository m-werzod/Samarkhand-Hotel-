import { AdminPageHeader } from '@/components/admin/admin-shell';
import { CampaignForm } from '@/components/admin/campaign-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function NewCampaignPage() {
  await requireRole('editor');

  const store = getStore();
  const [media, offers, rooms] = await Promise.all([
    store.listMedia({ type: 'image' }),
    store.listOffers(),
    store.listRooms({ statuses: ['published'] }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Yangi kampaniya"
        description="Slaydni qoralama sifatida saqlab, koʻrinishini tekshirib, keyin chop eting."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <CampaignForm campaign={null} media={media} offers={offers} rooms={rooms} />
      </div>
    </>
  );
}
