import type { Campaign } from './types';

/**
 * Campaign scheduling.
 *
 * A campaign is shown publicly only when all three hold:
 *   - its status is `published`;
 *   - its start time has passed (or it has none);
 *   - its end time has not passed (or it has none).
 *
 * An expired campaign is never rendered as if it were live. That is the
 * difference between a promotion and a false advertisement.
 */

export type CampaignEligibility =
  | 'eligible'
  | 'not_published'
  | 'scheduled'
  | 'expired';

export function campaignEligibility(
  campaign: Pick<Campaign, 'status' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): CampaignEligibility {
  if (campaign.status !== 'published') return 'not_published';

  const nowMs = now.getTime();

  if (campaign.startsAt) {
    const starts = new Date(campaign.startsAt).getTime();
    if (Number.isFinite(starts) && starts > nowMs) return 'scheduled';
  }

  if (campaign.endsAt) {
    const ends = new Date(campaign.endsAt).getTime();
    // End is exclusive: a campaign ending at 00:00 is over at 00:00.
    if (Number.isFinite(ends) && ends <= nowMs) return 'expired';
  }

  return 'eligible';
}

export function isCampaignLive(
  campaign: Pick<Campaign, 'status' | 'startsAt' | 'endsAt'>,
  now: Date = new Date(),
): boolean {
  return campaignEligibility(campaign, now) === 'eligible';
}

/**
 * Order campaigns for the carousel: priority first, then the most recently
 * started, then id for a stable, test-friendly result.
 */
export function sortCampaigns<
  T extends Pick<Campaign, 'id' | 'priority' | 'startsAt'>,
>(campaigns: T[]): T[] {
  return [...campaigns].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    const aStart = a.startsAt ? new Date(a.startsAt).getTime() : 0;
    const bStart = b.startsAt ? new Date(b.startsAt).getTime() : 0;
    if (aStart !== bStart) return bStart - aStart;
    return a.id.localeCompare(b.id);
  });
}

/** The live, ordered slide list for the public carousel. */
export function selectLiveCampaigns<
  T extends Pick<Campaign, 'id' | 'priority' | 'startsAt' | 'endsAt' | 'status'>,
>(campaigns: T[], now: Date = new Date(), limit = 8): T[] {
  return sortCampaigns(campaigns.filter((c) => isCampaignLive(c, now))).slice(
    0,
    limit,
  );
}

/* -------------------------------------------------------------------------- */
/* CTA safety                                                                  */
/* -------------------------------------------------------------------------- */

/** Protocols that must never reach an `href` the CMS controls. */
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file|blob):/i;

/** External destinations an administrator is allowed to link out to. */
const ALLOWED_EXTERNAL_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  't.me',
  'telegram.me',
  'wa.me',
  'api.whatsapp.com',
  'maps.google.com',
  'www.google.com',
  'goo.gl',
]);

export type CtaValidation =
  | { ok: true; href: string; external: boolean }
  | { ok: false; reason: 'empty' | 'unsafe_scheme' | 'host_not_allowed' | 'malformed' };

/**
 * Validate an administrator-supplied CTA destination.
 *
 * Site-relative paths are preferred and always allowed. Absolute URLs are
 * restricted to an allowlist of hosts so a compromised or careless CMS entry
 * cannot turn the homepage into an open redirect or a phishing hop.
 */
export function validateCtaHref(raw: string | null | undefined): CtaValidation {
  const value = (raw ?? '').trim();
  if (value.length === 0) return { ok: false, reason: 'empty' };

  if (DANGEROUS_SCHEMES.test(value)) {
    return { ok: false, reason: 'unsafe_scheme' };
  }

  // Site-relative: must be a single leading slash. `//evil.com` is protocol
  // relative and would leave the site, so it is rejected here.
  if (value.startsWith('/')) {
    if (value.startsWith('//')) return { ok: false, reason: 'host_not_allowed' };
    return { ok: true, href: value, external: false };
  }

  // In-page anchors and tel:/mailto: are safe and useful on campaign slides.
  if (value.startsWith('#')) return { ok: true, href: value, external: false };
  if (/^(tel|mailto):/i.test(value)) {
    return { ok: true, href: value, external: false };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'unsafe_scheme' };
  if (!ALLOWED_EXTERNAL_HOSTS.has(url.hostname)) {
    return { ok: false, reason: 'host_not_allowed' };
  }

  return { ok: true, href: url.toString(), external: true };
}

export const CTA_VALIDATION_MESSAGES: Record<
  Exclude<CtaValidation, { ok: true }>['reason'],
  string
> = {
  empty: 'Havola kiritilmagan.',
  unsafe_scheme: 'Faqat sayt ichidagi havolalar yoki https manzillar ruxsat etiladi.',
  host_not_allowed: 'Bu domenga havola berish ruxsat etilmagan.',
  malformed: 'Havola formati notoʻgʻri.',
};
