import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, with later Tailwind utilities winning. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Crypto-strong random identifier, safe in both the Edge and Node runtimes.
 * Used for anonymous analytics session ids and booking references.
 */
export function randomId(length = 16): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    // `bytes[i]` is always defined for i < length; the non-null assertion is
    // required only because noUncheckedIndexedAccess widens the type.
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/** Clamp a number into an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Pick a stable, URL-safe slug from free text (Uzbek Latin aware). */
export function slugify(input: string): string {
  const translit: Record<string, string> = {
    'ʻ': '',
    'ʼ': '',
    '‘': '',
    '’': '',
    ş: 's',
    ç: 'c',
    ğ: 'g',
    ö: 'o',
    ü: 'u',
    ı: 'i',
  };
  return input
    .toLowerCase()
    .replace(/[ʻʼ‘’şçğöüı]/g, (ch) => translit[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

/** Narrow unknown errors to a readable message without leaking internals. */
export function toSafeMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.name === 'ValidationError') {
    return error.message;
  }
  return fallback;
}

/** Type guard for non-empty strings, handy when reading env vars. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
