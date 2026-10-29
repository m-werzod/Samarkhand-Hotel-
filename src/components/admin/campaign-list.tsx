'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  deleteCampaignAction,
  duplicateCampaignAction,
  reorderCampaignsAction,
  setCampaignStatusAction,
} from '@/app/admin/actions/content';
import { MediaImage } from '@/components/site/media-image';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { campaignEligibility } from '@/lib/domain/campaigns';
import { cn } from '@/lib/utils';
import type { Campaign, MediaAsset } from '@/lib/domain/types';

const ELIGIBILITY = {
  eligible: { tone: 'success' as const, text: 'Saytda' },
  not_published: { tone: 'neutral' as const, text: 'Qoralama' },
  scheduled: { tone: 'info' as const, text: 'Rejalashtirilgan' },
  expired: { tone: 'danger' as const, text: 'Muddati tugagan' },
};

/**
 * Campaign list with ordering controls.
 *
 * Reordering uses explicit up/down buttons rather than drag-and-drop.
 * Dragging is pleasant with a mouse and close to unusable with a keyboard or
 * on a phone, and this list is short. The arrows work everywhere, announce
 * themselves, and produce exactly the same stored priorities.
 */
export function CampaignList({
  campaigns,
  media,
  canDelete,
}: {
  campaigns: Campaign[];
  media: MediaAsset[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [order, setOrder] = React.useState(campaigns.map((c) => c.id));
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Campaign | null>(null);
  const [savingOrder, setSavingOrder] = React.useState(false);

  // Follow the server when the list changes underneath us.
  React.useEffect(() => {
    setOrder(campaigns.map((c) => c.id));
  }, [campaigns]);

  const byId = new Map(campaigns.map((c) => [c.id, c]));
  const mediaById = new Map(media.map((m) => [m.id, m]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is Campaign => Boolean(c));
  const dirty = order.some((id, index) => campaigns[index]?.id !== id);

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    setOrder(next);
  }

  async function saveOrder() {
    setSavingOrder(true);
    const result = await reorderCampaignsAction(order);
    setSavingOrder(false);
    if (!result.ok) {
      push({ tone: 'error', title: result.message });
      return;
    }
    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  async function toggleStatus(campaign: Campaign) {
    setPendingId(campaign.id);
    const next = campaign.status === 'published' ? 'draft' : 'published';
    const result = await setCampaignStatusAction(campaign.id, next);
    setPendingId(null);
    push({
      tone: result.ok ? 'success' : 'error',
      title: result.message,
    });
    if (result.ok) router.refresh();
  }

  async function duplicate(campaign: Campaign) {
    setPendingId(campaign.id);
    const result = await duplicateCampaignAction(campaign.id);
    setPendingId(null);
    if (!result.ok) {
      push({ tone: 'error', title: result.message });
      return;
    }
    push({ tone: 'success', title: result.message });
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    const result = await deleteCampaignAction(deleteTarget.id);
    setPendingId(null);
    setDeleteTarget(null);
    push({ tone: result.ok ? 'success' : 'error', title: result.message });
    if (result.ok) router.refresh();
  }

  return (
    <>
      {dirty ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-info-600/30 bg-info-100 px-4 py-3">
          <p className="flex-1 text-sm text-info-600">
            Tartib oʻzgartirildi. Saqlamaguningizcha saytda eski tartib qoladi.
          </p>
          <Button size="sm" loading={savingOrder} onClick={saveOrder}>
            Tartibni saqlash
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOrder(campaigns.map((c) => c.id))}
          >
            Qaytarish
          </Button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {ordered.map((campaign, index) => {
          const state = campaignEligibility(campaign);
          const asset = campaign.mediaId ? mediaById.get(campaign.mediaId) : null;
          const busy = pendingId === campaign.id;

          return (
            <li key={campaign.id}>
              <Card tone="plain" className="overflow-hidden">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="w-full shrink-0 overflow-hidden rounded-md sm:w-40">
                    <MediaImage asset={asset ?? null} sizes="160px" aspect="16 / 9" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg text-chocolate-800">
                        {campaign.title ?? <em className="text-brown-300">Matnsiz slayd</em>}
                      </h3>
                      <Badge tone={ELIGIBILITY[state].tone}>{ELIGIBILITY[state].text}</Badge>
                      {campaign.badge ? <Badge tone="gold">{campaign.badge}</Badge> : null}
                    </div>

                    {campaign.subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-brown-400">
                        {campaign.subtitle}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-brown-300">
                      Ustuvorlik {campaign.priority}
                      {campaign.ctaHref ? ` · ${campaign.ctaHref}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <IconAction
                      label="Yuqoriga"
                      icon={ArrowUp}
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    />
                    <IconAction
                      label="Pastga"
                      icon={ArrowDown}
                      disabled={index === ordered.length - 1}
                      onClick={() => move(index, 1)}
                    />
                    <IconAction
                      label={campaign.status === 'published' ? 'Yashirish' : 'Chop etish'}
                      icon={campaign.status === 'published' ? EyeOff : Eye}
                      busy={busy}
                      onClick={() => toggleStatus(campaign)}
                    />
                    <IconAction
                      label="Nusxalash"
                      icon={Copy}
                      busy={busy}
                      onClick={() => duplicate(campaign)}
                    />
                    <Button asChild variant="ghost" size="iconSm">
                      <Link href={`/admin/campaigns/${campaign.id}`}>
                        <Pencil aria-hidden="true" />
                        <span className="sr-only">Tahrirlash</span>
                      </Link>
                    </Button>
                    {canDelete ? (
                      <IconAction
                        label="Oʻchirish"
                        icon={Trash2}
                        danger
                        onClick={() => setDeleteTarget(campaign)}
                      />
                    ) : null}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Kampaniya oʻchirilsinmi?"
        description={`"${deleteTarget?.title ?? 'Matnsiz slayd'}" butunlay oʻchiriladi. Vaqtincha yashirish uchun uni arxivlang.`}
        confirmLabel="Ha, oʻchirilsin"
        pending={pendingId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  disabled,
  busy,
  danger,
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        danger
          ? 'text-danger-600 hover:bg-danger-100'
          : 'text-brown-400 hover:bg-sand-200 hover:text-chocolate-800',
      )}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
