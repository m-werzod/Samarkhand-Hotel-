import { AdminPageHeader } from '@/components/admin/admin-shell';
import { SettingsForm } from '@/components/admin/settings-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { getIntegrationStatuses } from '@/lib/env';

export default async function AdminSettingsPage() {
  // Settings carry contact details and pricing policy, so they are
  // admin-only rather than editor-writable.
  await requireRole('admin');

  const settings = await getStore().getHotelSettings();

  return (
    <>
      <AdminPageHeader
        title="Sozlamalar"
        description="Mehmonxona maʼlumotlari, aloqa kanallari, valyuta va SEO. Bu yerdagi qiymatlar saytning hamma joyida ishlatiladi."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <SettingsForm settings={settings} integrations={getIntegrationStatuses()} />
      </div>
    </>
  );
}
