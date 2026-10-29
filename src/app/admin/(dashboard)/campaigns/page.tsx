import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { CampaignList } from '@/components/admin/campaign-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function AdminCampaignsPage() {
  const identity = await requireRole('viewer');

  const store = getStore();
  const [campaigns, media] = await Promise.all([
    store.listCampaigns(),
    store.listMedia(),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Kampaniyalar"
        description="Bosh sahifadagi karusel slaydlari. Faqat chop etilgan va joriy muddatdagi kampaniyalar saytda koʻrinadi."
        actions={
          <Button asChild size="md">
            <Link href="/admin/campaigns/new">
              <Plus aria-hidden="true" />
              Yangi kampaniya
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<Megaphone />}
            title="Hali kampaniya yoʻq"
            description="Birinchi slaydni yarating — u bosh sahifadagi karuselda koʻrinadi."
            action={
              <Button asChild>
                <Link href="/admin/campaigns/new">
                  <Plus aria-hidden="true" />
                  Yangi kampaniya
                </Link>
              </Button>
            }
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            media={media}
            canDelete={identity.role === 'admin'}
          />
        )}
      </div>
    </>
  );
}
