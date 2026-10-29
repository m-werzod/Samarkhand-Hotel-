import { describe, expect, it } from 'vitest';

import {
  campaignEligibility,
  isCampaignLive,
  selectLiveCampaigns,
  sortCampaigns,
  validateCtaHref,
} from '@/lib/domain/campaigns';

const NOW = new Date('2026-03-15T12:00:00.000Z');

const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  priority: 50,
  status: 'published' as const,
  startsAt: null as string | null,
  endsAt: null as string | null,
  ...overrides,
});

describe('campaign scheduling', () => {
  it('shows a published campaign with no window', () => {
    expect(campaignEligibility(campaign(), NOW)).toBe('eligible');
  });

  it('hides a draft', () => {
    expect(campaignEligibility(campaign({ status: 'draft' }), NOW)).toBe('not_published');
  });

  it('hides an archived campaign', () => {
    expect(campaignEligibility(campaign({ status: 'archived' }), NOW)).toBe(
      'not_published',
    );
  });

  it('reports a future campaign as scheduled, not live', () => {
    expect(
      campaignEligibility(campaign({ startsAt: '2026-04-01T00:00:00.000Z' }), NOW),
    ).toBe('scheduled');
  });

  it('reports a past campaign as expired, never as live', () => {
    expect(
      campaignEligibility(campaign({ endsAt: '2026-03-01T00:00:00.000Z' }), NOW),
    ).toBe('expired');
  });

  it('treats the end instant as exclusive', () => {
    expect(campaignEligibility(campaign({ endsAt: NOW.toISOString() }), NOW)).toBe(
      'expired',
    );
  });

  it('ignores an unparseable date rather than hiding the campaign', () => {
    expect(isCampaignLive(campaign({ startsAt: 'not-a-date' }), NOW)).toBe(true);
  });
});

describe('ordering', () => {
  it('sorts by priority, highest first', () => {
    const sorted = sortCampaigns([
      campaign({ id: 'low', priority: 10 }),
      campaign({ id: 'high', priority: 90 }),
      campaign({ id: 'mid', priority: 50 }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(['high', 'mid', 'low']);
  });

  it('breaks ties by most recent start, then by id', () => {
    const sorted = sortCampaigns([
      campaign({ id: 'older', startsAt: '2026-01-01T00:00:00.000Z' }),
      campaign({ id: 'newer', startsAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    expect(sorted[0]?.id).toBe('newer');

    const stable = sortCampaigns([campaign({ id: 'z' }), campaign({ id: 'a' })]);
    expect(stable[0]?.id).toBe('a');
  });

  it('selects only live campaigns and respects the limit', () => {
    const result = selectLiveCampaigns(
      [
        campaign({ id: 'live', priority: 10 }),
        campaign({ id: 'draft', status: 'draft' }),
        campaign({ id: 'expired', endsAt: '2026-01-01T00:00:00.000Z' }),
        campaign({ id: 'live2', priority: 20 }),
      ],
      NOW,
      1,
    );
    expect(result.map((c) => c.id)).toEqual(['live2']);
  });
});

describe('CTA destination validation', () => {
  it('accepts a site-relative path', () => {
    const result = validateCtaHref('/rooms');
    expect(result).toEqual({ ok: true, href: '/rooms', external: false });
  });

  it('accepts an in-page anchor, tel: and mailto:', () => {
    expect(validateCtaHref('#offers').ok).toBe(true);
    expect(validateCtaHref('tel:+998900000000').ok).toBe(true);
    expect(validateCtaHref('mailto:a@example.com').ok).toBe(true);
  });

  it('rejects javascript: in any casing', () => {
    expect(validateCtaHref('javascript:alert(1)')).toEqual({
      ok: false,
      reason: 'unsafe_scheme',
    });
    expect(validateCtaHref('JavaScript:alert(1)').ok).toBe(false);
    expect(validateCtaHref('  javascript:alert(1)').ok).toBe(false);
  });

  it('rejects data: and vbscript:', () => {
    expect(validateCtaHref('data:text/html,<script>').ok).toBe(false);
    expect(validateCtaHref('vbscript:msgbox').ok).toBe(false);
  });

  it('rejects protocol-relative URLs, which leave the site', () => {
    expect(validateCtaHref('//evil.example/path')).toEqual({
      ok: false,
      reason: 'host_not_allowed',
    });
  });

  it('rejects http, even to an allowlisted host', () => {
    expect(validateCtaHref('http://instagram.com/x')).toEqual({
      ok: false,
      reason: 'unsafe_scheme',
    });
  });

  it('rejects a host that is not on the allowlist', () => {
    expect(validateCtaHref('https://evil.example')).toEqual({
      ok: false,
      reason: 'host_not_allowed',
    });
  });

  it('rejects a lookalike host that merely ends with an allowed name', () => {
    expect(validateCtaHref('https://notinstagram.com/x').ok).toBe(false);
    expect(validateCtaHref('https://instagram.com.evil.example/x').ok).toBe(false);
  });

  it('accepts allowlisted external hosts and marks them external', () => {
    const result = validateCtaHref('https://t.me/samarkhand');
    expect(result).toMatchObject({ ok: true, external: true });
  });

  it('rejects empty and malformed values', () => {
    expect(validateCtaHref('')).toEqual({ ok: false, reason: 'empty' });
    expect(validateCtaHref(null)).toEqual({ ok: false, reason: 'empty' });
    expect(validateCtaHref('https://')).toEqual({ ok: false, reason: 'malformed' });
  });
});
