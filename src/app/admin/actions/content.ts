'use server';

import { revalidatePath } from 'next/cache';

import { requireRole, ForbiddenError, UnauthorizedError } from '@/lib/auth';
import { getStore } from '@/lib/data';
import { ConflictError, NotFoundError } from '@/lib/data/store';
import { assertTransition, BookingTransitionError } from '@/lib/domain/booking';
import { fromMajorUnits } from '@/lib/domain/money';
import { randomId, slugify } from '@/lib/utils';
import {
  bookingNoteSchema,
  bookingStatusUpdateSchema,
  campaignInputSchema,
  hotelSettingsSchema,
  inquiryStatusUpdateSchema,
  mediaMetadataSchema,
  offerInputSchema,
  roomInputSchema,
  siteContentSchema,
} from '@/lib/validation/schemas';
import type {
  Campaign,
  MediaCategory,
  Offer,
  PublicationStatus,
  Room,
} from '@/lib/domain/types';

/**
 * Admin mutations.
 *
 * Every function here starts with `requireRole`. That is not belt and braces
 * on top of the middleware — a server action is a POST endpoint that any
 * client can invoke directly, so this is the authorisation boundary.
 *
 * Every successful mutation writes an audit entry and revalidates the public
 * paths it affects, so an edit is visible on the site without a deploy and
 * attributable afterwards.
 */

export interface AdminResult<T = undefined> {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

/* -------------------------------------------------------------------------- */
/* Shared plumbing                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Wraps a mutation with authorisation, error translation and auditing.
 *
 * Unexpected errors are logged with their detail and returned as a generic
 * message: a Postgres error can name columns and values, and an admin screen
 * is not a reason to relay them.
 */
async function guarded<T>(
  action: string,
  minimumRole: 'viewer' | 'editor' | 'admin',
  run: (actor: string) => Promise<AdminResult<T>>,
): Promise<AdminResult<T>> {
  try {
    const identity = await requireRole(minimumRole);
    return await run(identity.email);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, message: 'Sessiya tugagan. Qaytadan kiring.' };
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, message: 'Bu amal uchun ruxsatingiz yoʻq.' };
    }
    if (error instanceof ConflictError || error instanceof BookingTransitionError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, message: 'Yozuv topilmadi.' };
    }
    console.error(`[admin:${action}]`, error);
    return { ok: false, message: 'Amalni bajarib boʻlmadi. Qaytadan urinib koʻring.' };
  }
}

interface ZodIssue {
  path: (string | number | symbol)[];
  message: string;
}

function fieldErrors(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form';
    out[key] ??= issue.message;
  }
  return out;
}

/** Field-level before/after, for the audit log. */
function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(after)) {
    const previous = before[key];
    if (JSON.stringify(previous) !== JSON.stringify(value)) {
      changes[key] = { from: previous, to: value };
    }
  }
  return changes;
}

/** Public paths that depend on hotel content. */
const PUBLIC_PATHS = [
  '/',
  '/rooms',
  '/offers',
  '/amenities',
  '/gallery',
  '/location',
  '/contact',
] as const;

function revalidatePublic(extra: string[] = []): void {
  for (const path of [...PUBLIC_PATHS, ...extra]) {
    revalidatePath(path);
  }
}

/* -------------------------------------------------------------------------- */
/* Rooms                                                                       */
/* -------------------------------------------------------------------------- */

export async function saveRoomAction(
  input: unknown,
  roomId?: string,
): Promise<AdminResult<{ id: string; slug: string }>> {
  return guarded('room.save', 'editor', async (actor) => {
    const parsed = roomInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Formadagi maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;
    const store = getStore();
    const slug = data.slug || slugify(data.name);

    const payload: Omit<Room, 'id' | 'createdAt' | 'updatedAt'> = {
      slug,
      name: data.name,
      shortDescription: data.shortDescription,
      description: data.description,
      maxOccupancy: data.maxOccupancy,
      maxAdults: data.maxAdults,
      maxChildren: data.maxChildren,
      bedConfiguration: data.bedConfiguration,
      sizeSqm: data.sizeSqm ?? null,
      basePrice: fromMajorUnits(data.basePriceMajor, data.currency),
      status: data.status,
      sortOrder: data.sortOrder,
      inventoryCount: data.inventoryCount,
      cancellationPolicy: data.cancellationPolicy ?? null,
      isDemoData: data.isDemoData,
      amenityIds: data.amenityIds,
      mediaIds: data.mediaIds,
    };

    if (roomId) {
      const before = await store.getRoomById(roomId);
      if (!before) return { ok: false, message: 'Xona topilmadi.' };

      const updated = await store.updateRoom(roomId, payload);
      await store.recordAudit({
        actor,
        action: 'room.updated',
        entityType: 'room',
        entityId: roomId,
        changes: diff(before as unknown as Record<string, unknown>, payload),
      });
      revalidatePublic([`/rooms/${before.slug}`, `/rooms/${updated.slug}`]);
      return {
        ok: true,
        message: 'Xona saqlandi.',
        data: { id: updated.id, slug: updated.slug },
      };
    }

    const created = await store.createRoom({
      ...payload,
      id: `room-${slugify(data.name) || randomId(8).toLowerCase()}-${randomId(4).toLowerCase()}`,
    });
    await store.recordAudit({
      actor,
      action: 'room.created',
      entityType: 'room',
      entityId: created.id,
      changes: null,
    });
    revalidatePublic([`/rooms/${created.slug}`]);
    return {
      ok: true,
      message: 'Xona yaratildi.',
      data: { id: created.id, slug: created.slug },
    };
  });
}

export async function setRoomStatusAction(
  roomId: string,
  status: PublicationStatus,
): Promise<AdminResult> {
  return guarded('room.status', 'editor', async (actor) => {
    const store = getStore();
    const before = await store.getRoomById(roomId);
    if (!before) return { ok: false, message: 'Xona topilmadi.' };

    await store.updateRoom(roomId, { status });
    await store.recordAudit({
      actor,
      action: 'room.status_changed',
      entityType: 'room',
      entityId: roomId,
      changes: { status: { from: before.status, to: status } },
    });
    revalidatePublic([`/rooms/${before.slug}`]);
    return { ok: true, message: 'Xona holati yangilandi.' };
  });
}

export async function deleteRoomAction(roomId: string): Promise<AdminResult> {
  return guarded('room.delete', 'admin', async (actor) => {
    const store = getStore();
    const before = await store.getRoomById(roomId);
    if (!before) return { ok: false, message: 'Xona topilmadi.' };

    await store.deleteRoom(roomId);
    await store.recordAudit({
      actor,
      action: 'room.deleted',
      entityType: 'room',
      entityId: roomId,
      changes: { name: { from: before.name, to: null } },
    });
    revalidatePublic([`/rooms/${before.slug}`]);
    return { ok: true, message: 'Xona oʻchirildi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Offers                                                                      */
/* -------------------------------------------------------------------------- */

export async function saveOfferAction(
  input: unknown,
  offerId?: string,
): Promise<AdminResult<{ id: string }>> {
  return guarded('offer.save', 'editor', async (actor) => {
    const parsed = offerInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Formadagi maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;
    const store = getStore();
    const settings = await store.getHotelSettings();

    const payload: Omit<Offer, 'id' | 'createdAt' | 'updatedAt'> = {
      name: data.name,
      description: data.description,
      discountType: data.discountType,
      // A fixed discount is typed in major units and stored in minor ones;
      // a percentage is a plain number and must not be scaled.
      discountValue:
        data.discountType === 'fixed'
          ? fromMajorUnits(data.discountValue, settings.currency).amount
          : data.discountValue,
      eligibleRoomIds: data.eligibleRoomIds,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      minimumNights: data.minimumNights,
      conditions: data.conditions ?? null,
      status: data.status,
    };

    if (offerId) {
      const before = await store.getOfferById(offerId);
      if (!before) return { ok: false, message: 'Taklif topilmadi.' };
      const updated = await store.updateOffer(offerId, payload);
      await store.recordAudit({
        actor,
        action: 'offer.updated',
        entityType: 'offer',
        entityId: offerId,
        changes: diff(before as unknown as Record<string, unknown>, payload),
      });
      revalidatePublic();
      return { ok: true, message: 'Taklif saqlandi.', data: { id: updated.id } };
    }

    const created = await store.createOffer({
      ...payload,
      id: `offer-${slugify(data.name) || randomId(8).toLowerCase()}-${randomId(4).toLowerCase()}`,
    });
    await store.recordAudit({
      actor,
      action: 'offer.created',
      entityType: 'offer',
      entityId: created.id,
      changes: null,
    });
    revalidatePublic();
    return { ok: true, message: 'Taklif yaratildi.', data: { id: created.id } };
  });
}

export async function deleteOfferAction(offerId: string): Promise<AdminResult> {
  return guarded('offer.delete', 'admin', async (actor) => {
    const store = getStore();
    await store.deleteOffer(offerId);
    await store.recordAudit({
      actor,
      action: 'offer.deleted',
      entityType: 'offer',
      entityId: offerId,
      changes: null,
    });
    revalidatePublic();
    return { ok: true, message: 'Taklif oʻchirildi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveCampaignAction(
  input: unknown,
  campaignId?: string,
): Promise<AdminResult<{ id: string }>> {
  return guarded('campaign.save', 'editor', async (actor) => {
    const parsed = campaignInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Formadagi maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;
    const store = getStore();

    const payload: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> = {
      title: data.title ?? null,
      subtitle: data.subtitle ?? null,
      badge: data.badge ?? null,
      mediaId: data.mediaId ?? null,
      mobileMediaId: data.mobileMediaId ?? null,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      offerId: data.offerId ?? null,
      roomId: data.roomId ?? null,
      status: data.status,
      priority: data.priority,
      startsAt: data.startsAt ?? null,
      endsAt: data.endsAt ?? null,
      textAlign: data.textAlign,
      overlay: data.overlay,
    };

    if (campaignId) {
      const before = await store.getCampaignById(campaignId);
      if (!before) return { ok: false, message: 'Kampaniya topilmadi.' };
      const updated = await store.updateCampaign(campaignId, payload);
      await store.recordAudit({
        actor,
        action: 'campaign.updated',
        entityType: 'campaign',
        entityId: campaignId,
        changes: diff(before as unknown as Record<string, unknown>, payload),
      });
      revalidatePublic();
      return { ok: true, message: 'Kampaniya saqlandi.', data: { id: updated.id } };
    }

    const created = await store.createCampaign({
      ...payload,
      id: `campaign-${randomId(10).toLowerCase()}`,
    });
    await store.recordAudit({
      actor,
      action: 'campaign.created',
      entityType: 'campaign',
      entityId: created.id,
      changes: null,
    });
    revalidatePublic();
    return { ok: true, message: 'Kampaniya yaratildi.', data: { id: created.id } };
  });
}

export async function setCampaignStatusAction(
  campaignId: string,
  status: PublicationStatus,
): Promise<AdminResult> {
  return guarded('campaign.status', 'editor', async (actor) => {
    const store = getStore();
    const before = await store.getCampaignById(campaignId);
    if (!before) return { ok: false, message: 'Kampaniya topilmadi.' };

    await store.updateCampaign(campaignId, { status });
    await store.recordAudit({
      actor,
      action: 'campaign.status_changed',
      entityType: 'campaign',
      entityId: campaignId,
      changes: { status: { from: before.status, to: status } },
    });
    revalidatePublic();
    return {
      ok: true,
      message: status === 'published' ? 'Kampaniya chop etildi.' : 'Kampaniya holati yangilandi.',
    };
  });
}

/** Copy a campaign as a draft, so an operator can iterate without risk. */
export async function duplicateCampaignAction(
  campaignId: string,
): Promise<AdminResult<{ id: string }>> {
  return guarded('campaign.duplicate', 'editor', async (actor) => {
    const store = getStore();
    const source = await store.getCampaignById(campaignId);
    if (!source) return { ok: false, message: 'Kampaniya topilmadi.' };

    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    const created = await store.createCampaign({
      ...rest,
      id: `campaign-${randomId(10).toLowerCase()}`,
      title: source.title ? `${source.title} (nusxa)` : null,
      status: 'draft',
    });

    await store.recordAudit({
      actor,
      action: 'campaign.duplicated',
      entityType: 'campaign',
      entityId: created.id,
      changes: { source: { from: null, to: campaignId } },
    });
    return { ok: true, message: 'Nusxa yaratildi.', data: { id: created.id } };
  });
}

export async function reorderCampaignsAction(
  orderedIds: string[],
): Promise<AdminResult> {
  return guarded('campaign.reorder', 'editor', async (actor) => {
    const store = getStore();
    await store.reorderCampaigns(orderedIds);
    await store.recordAudit({
      actor,
      action: 'campaign.reordered',
      entityType: 'campaign',
      entityId: 'bulk',
      changes: { order: { from: null, to: orderedIds } },
    });
    revalidatePublic();
    return { ok: true, message: 'Tartib saqlandi.' };
  });
}

export async function deleteCampaignAction(campaignId: string): Promise<AdminResult> {
  return guarded('campaign.delete', 'admin', async (actor) => {
    const store = getStore();
    await store.deleteCampaign(campaignId);
    await store.recordAudit({
      actor,
      action: 'campaign.deleted',
      entityType: 'campaign',
      entityId: campaignId,
      changes: null,
    });
    revalidatePublic();
    return { ok: true, message: 'Kampaniya oʻchirildi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

export async function updateMediaMetadataAction(
  mediaId: string,
  input: unknown,
): Promise<AdminResult> {
  return guarded('media.update', 'editor', async (actor) => {
    const parsed = mediaMetadataSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const store = getStore();
    const before = await store.getMediaById(mediaId);
    if (!before) return { ok: false, message: 'Fayl topilmadi.' };

    const patch = {
      altText: parsed.data.altText,
      caption: parsed.data.caption ?? null,
      category: parsed.data.category as MediaCategory,
      kind: parsed.data.kind,
    };

    await store.updateMedia(mediaId, patch);
    await store.recordAudit({
      actor,
      action: 'media.updated',
      entityType: 'media',
      entityId: mediaId,
      changes: diff(before as unknown as Record<string, unknown>, patch),
    });
    revalidatePublic();
    return { ok: true, message: 'Saqlandi.' };
  });
}

export async function deleteMediaAction(mediaId: string): Promise<AdminResult> {
  return guarded('media.delete', 'admin', async (actor) => {
    const store = getStore();

    // Refuse rather than leave a published page with a broken image.
    const references = await store.findMediaReferences(mediaId);
    if (references.length > 0) {
      return {
        ok: false,
        message: `Bu fayl ${references.length} ta yozuvda ishlatilmoqda: ${references
          .map((r) => r.label)
          .join(', ')}. Avval ularni oʻzgartiring.`,
      };
    }

    await store.deleteMedia(mediaId);
    await store.recordAudit({
      actor,
      action: 'media.deleted',
      entityType: 'media',
      entityId: mediaId,
      changes: null,
    });
    revalidatePublic();
    return { ok: true, message: 'Fayl oʻchirildi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Bookings                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateBookingStatusAction(input: unknown): Promise<AdminResult> {
  return guarded('booking.status', 'editor', async (actor) => {
    const parsed = bookingStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: 'Notoʻgʻri soʻrov.' };
    }

    const store = getStore();
    const booking = await store.getBookingById(parsed.data.bookingId);
    if (!booking) return { ok: false, message: 'Bron topilmadi.' };

    // Reject the move before touching the store, so the operator gets a clear
    // reason instead of a database error.
    assertTransition(booking.status, parsed.data.status);

    await store.transitionBooking({
      id: booking.id,
      expectedStatus: booking.status,
      nextStatus: parsed.data.status,
      actor,
      reason: parsed.data.reason ?? null,
    });

    await store.recordAudit({
      actor,
      action: 'booking.status_changed',
      entityType: 'booking',
      entityId: booking.id,
      changes: { status: { from: booking.status, to: parsed.data.status } },
    });

    revalidatePath('/admin/bookings');
    revalidatePath(`/admin/bookings/${booking.id}`);
    return { ok: true, message: 'Bron holati yangilandi.' };
  });
}

export async function updateBookingNotesAction(input: unknown): Promise<AdminResult> {
  return guarded('booking.notes', 'editor', async (actor) => {
    const parsed = bookingNoteSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Izohni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const store = getStore();
    await store.updateBookingNotes(parsed.data.bookingId, parsed.data.internalNotes);
    await store.recordAudit({
      actor,
      action: 'booking.note_added',
      entityType: 'booking',
      entityId: parsed.data.bookingId,
      // The note body is staff-only and stays out of the audit payload.
      changes: null,
    });

    revalidatePath(`/admin/bookings/${parsed.data.bookingId}`);
    return { ok: true, message: 'Izoh saqlandi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Inquiries                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateInquiryAction(input: unknown): Promise<AdminResult> {
  return guarded('inquiry.update', 'editor', async (actor) => {
    const parsed = inquiryStatusUpdateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: 'Notoʻgʻri soʻrov.' };
    }

    const store = getStore();
    const before = await store.getInquiryById(parsed.data.inquiryId);
    if (!before) return { ok: false, message: 'Xabar topilmadi.' };

    await store.updateInquiry(parsed.data.inquiryId, {
      status: parsed.data.status,
      ...(parsed.data.internalNotes !== undefined
        ? { internalNotes: parsed.data.internalNotes }
        : {}),
    });

    await store.recordAudit({
      actor,
      action: 'inquiry.updated',
      entityType: 'inquiry',
      entityId: parsed.data.inquiryId,
      changes: { status: { from: before.status, to: parsed.data.status } },
    });

    revalidatePath('/admin/inquiries');
    return { ok: true, message: 'Saqlandi.' };
  });
}

/* -------------------------------------------------------------------------- */
/* Settings + content                                                          */
/* -------------------------------------------------------------------------- */

export async function saveSettingsAction(input: unknown): Promise<AdminResult> {
  return guarded('settings.save', 'admin', async (actor) => {
    const parsed = hotelSettingsSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Formadagi maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;
    const store = getStore();
    const before = await store.getHotelSettings();

    const patch = {
      brandName: data.brandName,
      tagline: data.tagline,
      phone: data.phone,
      email: data.email,
      whatsappNumber: data.whatsappNumber || null,
      address: {
        line1: data.address.line1,
        line2: data.address.line2 ?? null,
        city: data.address.city,
        region: data.address.region ?? null,
        postalCode: data.address.postalCode ?? null,
        country: data.address.country,
        latitude: data.address.latitude ?? null,
        longitude: data.address.longitude ?? null,
        mapsUrl: data.address.mapsUrl || null,
      },
      social: {
        instagram: data.social.instagram || null,
        telegram: data.social.telegram || null,
        whatsapp: data.social.whatsapp || null,
        facebook: data.social.facebook || null,
        youtube: data.social.youtube || null,
      },
      currency: data.currency,
      timeZone: data.timeZone,
      locale: data.locale,
      taxRatePercent: data.taxRatePercent,
      serviceFeeMinor: fromMajorUnits(data.serviceFeeMajor, data.currency).amount,
      checkInTime: data.checkInTime,
      checkOutTime: data.checkOutTime,
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      isDemoData: data.isDemoData,
    };

    await store.updateHotelSettings(patch);
    await store.recordAudit({
      actor,
      action: 'settings.updated',
      entityType: 'settings',
      entityId: 'settings',
      changes: diff(before as unknown as Record<string, unknown>, patch),
    });

    revalidatePublic(['/privacy', '/terms']);
    return { ok: true, message: 'Sozlamalar saqlandi.' };
  });
}

export async function saveContentAction(input: unknown): Promise<AdminResult> {
  return guarded('content.save', 'editor', async (actor) => {
    const parsed = siteContentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'Formadagi maʼlumotlarni tekshiring.',
        fieldErrors: fieldErrors(parsed.error.issues),
      };
    }

    const data = parsed.data;
    const store = getStore();
    const before = await store.getSiteContent();

    const patch = {
      heroHeadline: data.heroHeadline,
      heroSubheadline: data.heroSubheadline,
      heroMediaId: data.heroMediaId ?? null,
      heroVideoUrl: data.heroVideoUrl || null,
      aboutTitle: data.aboutTitle,
      aboutBody: data.aboutBody,
      benefits: data.benefits,
      footerBlurb: data.footerBlurb,
      privacyPolicy: data.privacyPolicy,
      bookingTerms: data.bookingTerms,
    };

    await store.updateSiteContent(patch);
    await store.recordAudit({
      actor,
      action: 'content.updated',
      entityType: 'content',
      entityId: 'content',
      changes: diff(before as unknown as Record<string, unknown>, patch),
    });

    revalidatePublic(['/privacy', '/terms']);
    return { ok: true, message: 'Matnlar saqlandi.' };
  });
}
