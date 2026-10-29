import 'server-only';

import { cache } from 'react';

import { getStore } from '@/lib/data';
import { selectLiveCampaigns } from '@/lib/domain/campaigns';
import { displayPriceForRoom, type DisplayPrice } from '@/lib/domain/pricing';
import type {
  Amenity,
  CampaignWithRelations,
  HotelSettings,
  MediaAsset,
  Offer,
  Room,
  RoomWithRelations,
  SiteContent,
} from '@/lib/domain/types';

/**
 * Read models for the public site.
 *
 * Each is wrapped in React `cache`, so a page that needs hotel settings in
 * its metadata, its header and its footer pays for one fetch rather than
 * three. The cache is per-request, so an admin edit is visible on the next
 * navigation without any invalidation dance.
 *
 * These functions join and shape data; they never decide what is published.
 * That stays in the store (and, under Supabase, in RLS).
 */

export const getSettings = cache(async (): Promise<HotelSettings> => {
  return getStore().getHotelSettings();
});

export const getContent = cache(async (): Promise<SiteContent> => {
  return getStore().getSiteContent();
});

export const getActiveAmenities = cache(async (): Promise<Amenity[]> => {
  return getStore().listAmenities(true);
});

export const getPublishedOffers = cache(async (): Promise<Offer[]> => {
  return getStore().listOffers(['published']);
});

export const getMediaIndex = cache(async (): Promise<Map<string, MediaAsset>> => {
  const assets = await getStore().listMedia();
  return new Map(assets.map((asset) => [asset.id, asset]));
});

/** Resolve a room's amenity and media ids into full records. */
async function hydrateRoom(room: Room): Promise<RoomWithRelations> {
  const [amenities, media] = await Promise.all([
    getActiveAmenities(),
    getMediaIndex(),
  ]);

  const amenityIndex = new Map(amenities.map((a) => [a.id, a]));

  return {
    ...room,
    amenities: room.amenityIds
      .map((id) => amenityIndex.get(id))
      .filter((a): a is Amenity => Boolean(a)),
    media: room.mediaIds
      .map((id) => media.get(id))
      .filter((m): m is MediaAsset => Boolean(m)),
  };
}

export const getPublishedRooms = cache(async (): Promise<RoomWithRelations[]> => {
  const rooms = await getStore().listRooms({ statuses: ['published'] });
  return Promise.all(rooms.map(hydrateRoom));
});

export const getRoomBySlug = cache(
  async (slug: string): Promise<RoomWithRelations | null> => {
    const room = await getStore().getRoomBySlug(slug);
    // A draft or archived room must 404 publicly, not render.
    if (!room || room.status !== 'published') return null;
    return hydrateRoom(room);
  },
);

/** Room list paired with its computed display price, in one pass. */
export const getRoomsWithPricing = cache(
  async (): Promise<{ room: RoomWithRelations; price: DisplayPrice }[]> => {
    const [rooms, offers] = await Promise.all([
      getPublishedRooms(),
      getPublishedOffers(),
    ]);
    return rooms.map((room) => ({
      room,
      price: displayPriceForRoom(room, offers),
    }));
  },
);

export const getLiveCampaigns = cache(
  async (): Promise<CampaignWithRelations[]> => {
    const store = getStore();
    const [campaigns, media, offers] = await Promise.all([
      store.listCampaigns(['published']),
      getMediaIndex(),
      getPublishedOffers(),
    ]);

    const offerIndex = new Map(offers.map((o) => [o.id, o]));

    return selectLiveCampaigns(campaigns).map((campaign) => ({
      ...campaign,
      media: campaign.mediaId ? (media.get(campaign.mediaId) ?? null) : null,
      mobileMedia: campaign.mobileMediaId
        ? (media.get(campaign.mobileMediaId) ?? null)
        : null,
      offer: campaign.offerId ? (offerIndex.get(campaign.offerId) ?? null) : null,
    }));
  },
);

export const getGalleryMedia = cache(async (): Promise<MediaAsset[]> => {
  const assets = await getStore().listMedia();
  // Campaign backdrops are marketing furniture, not gallery photography.
  return assets.filter((asset) => asset.category !== 'campaigns');
});

export const getPublishedTestimonials = cache(async () => {
  return getStore().listTestimonials(true);
});
