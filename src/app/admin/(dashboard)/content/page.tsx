import { AdminPageHeader } from '@/components/admin/admin-shell';
import { ContentForm } from '@/components/admin/content-form';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

export default async function AdminContentPage() {
  await requireRole('editor');

  const store = getStore();
  const [content, media] = await Promise.all([
    store.getSiteContent(),
    store.listMedia({ type: 'image' }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Sayt matnlari"
        description="Bosh sahifa, biz haqimizda boʻlimi, footer va huquqiy sahifalar. Saqlangach oʻzgarishlar saytda darhol koʻrinadi."
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <ContentForm content={content} media={media} />
      </div>
    </>
  );
}
