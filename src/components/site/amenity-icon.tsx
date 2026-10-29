import {
  BedDouble,
  BellRing,
  Car,
  Clock,
  Coffee,
  HeartHandshake,
  Lock,
  MapPin,
  MessageCircle,
  Plane,
  Shirt,
  Snowflake,
  Sparkles,
  Tv,
  UtensilsCrossed,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps a stored `iconKey` to a Lucide icon.
 *
 * Amenities are database rows, so the key is data rather than code. An
 * unrecognised key falls back to a neutral glyph instead of rendering
 * nothing — an amenity with a missing icon should still be readable.
 */
const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  coffee: Coffee,
  car: Car,
  snowflake: Snowflake,
  plane: Plane,
  utensils: UtensilsCrossed,
  shirt: Shirt,
  'bell-ring': BellRing,
  users: Users,
  clock: Clock,
  lock: Lock,
  tv: Tv,
  'bed-double': BedDouble,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  'heart-handshake': HeartHandshake,
};

export function AmenityIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}) {
  const Icon = ICONS[iconKey] ?? Sparkles;
  return <Icon className={className} aria-hidden="true" />;
}

export const AMENITY_ICON_KEYS = Object.keys(ICONS);
