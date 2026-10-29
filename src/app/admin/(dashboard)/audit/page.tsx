import { ScrollText } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/admin-shell';
import { Badge, Card, EmptyState } from '@/components/ui/surface';
import { requireRole } from '@/lib/auth';
import { getStore } from '@/lib/data';

const ACTION_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  created: 'success',
  updated: 'info',
  status_changed: 'info',
  published: 'success',
  deleted: 'danger',
  exported: 'warning',
};

export default async function AdminAuditPage() {
  // The audit log names who did what; viewers should not see colleagues'
  // activity, so it is restricted to admins.
  await requireRole('admin');

  const entries = await getStore().listAuditLogs(200);

  return (
    <>
      <AdminPageHeader
        title="Audit jurnali"
        description="Kim nima oʻzgartirganining yozuvi. Jurnalni tahrirlab yoki oʻchirib boʻlmaydi — maʼlumotlar bazasida ham faqat qoʻshish ruxsati bor."
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {entries.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title="Jurnal boʻsh"
            description="Admin panelida biror oʻzgarish qilinganda, u shu yerda qayd etiladi."
          />
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const suffix = entry.action.split('.')[1] ?? '';
              return (
                <li key={entry.id}>
                  <Card tone="plain" className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={ACTION_TONE[suffix] ?? 'neutral'}>
                          {entry.action}
                        </Badge>
                        <span className="text-sm text-chocolate-800">
                          {entry.entityType}
                        </span>
                        <code className="rounded bg-sand-200 px-1.5 py-0.5 text-xs text-brown-400">
                          {entry.entityId}
                        </code>
                      </div>
                      <p className="text-xs text-brown-300">
                        {new Date(entry.createdAt).toLocaleString('uz-UZ')} ·{' '}
                        {entry.actor}
                      </p>
                    </div>

                    {entry.changes && Object.keys(entry.changes).length > 0 ? (
                      <dl className="mt-3 space-y-1 border-t border-sand-200 pt-3 text-xs">
                        {Object.entries(entry.changes).map(([field, change]) => (
                          <div key={field} className="flex flex-wrap gap-2">
                            <dt className="font-medium text-chocolate-700">{field}:</dt>
                            <dd className="min-w-0 break-all text-brown-400">
                              <span className="line-through opacity-70">
                                {summarise(change.from)}
                              </span>{' '}
                              → <span>{summarise(change.to)}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/** Render a changed value compactly, truncating long text. */
function summarise(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') {
    return value.length > 80 ? `${value.slice(0, 80)}…` : value || '—';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const json = JSON.stringify(value);
  return json.length > 80 ? `${json.slice(0, 80)}…` : json;
}
