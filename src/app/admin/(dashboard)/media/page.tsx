import { AdminPageHeader } from '@/components/admin/admin-shell';
import { MediaLibrary } from '@/components/admin/media-library';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { getSupabaseServiceRoleKey, isSupabaseConfigured } from '@/lib/env';

export default async function AdminMediaPage() {
  const identity = await requireRole('viewer');

  const assets = await getStore().listMedia();
  const uploadsEnabled = isSupabaseConfigured() && Boolean(getSupabaseServiceRoleKey());

  return (
    <>
      <AdminPageHeader
        title="Media kutubxonasi"
        description="Xona va kampaniya tasvirlari. Har bir faylning alt matni majburiy — usiz tasvir skrinrider foydalanuvchilari uchun koʻrinmas boʻlib qoladi."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <MediaLibrary
          assets={assets}
          uploadsEnabled={uploadsEnabled}
          canDelete={identity.role === 'admin'}
        />
      </div>
    </>
  );
}
