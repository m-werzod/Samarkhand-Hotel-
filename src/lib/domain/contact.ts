/**
 * Contact-detail formatting.
 *
 * Kept out of the client component that renders contact buttons so Server
 * Components (the footer, structured data, the admin tables) can format a
 * phone number without pulling a client module across the boundary.
 */

/** `+998901234567` -> `+998 90 123 45 67`. Other formats pass through. */
export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10)}`;
  }
  return raw;
}

/** Digits only, no leading plus — the shape wa.me links require. */
export function toWhatsAppDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** `tel:` target: strip formatting but keep a leading plus. */
export function toTelHref(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `tel:+${digits}` : `tel:${digits}`;
}
