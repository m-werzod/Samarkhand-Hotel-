import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServiceRoleKey, publicEnv } from '@/lib/env';

/**
 * Supabase clients, separated by the authority they carry.
 *
 * Which one you reach for is a security decision, not a convenience one:
 *
 *  - `getServerClient()` acts as the signed-in visitor. Row Level Security
 *    applies. This is the default for anything a request touches.
 *  - `getServiceClient()` bypasses RLS entirely. Only for operations that
 *    genuinely need it (storage writes, the seed script) and never with a
 *    value that came from a request body without validation first.
 */

export class SupabaseNotConfiguredError extends Error {
  override name = 'SupabaseNotConfiguredError';
  constructor() {
    super(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
}

function requireConfig(): { url: string; anonKey: string } {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new SupabaseNotConfiguredError();
  }
  return { url: publicEnv.supabaseUrl, anonKey: publicEnv.supabaseAnonKey };
}

/**
 * Request-scoped client that reads and refreshes the auth cookie.
 *
 * Cookie writes are wrapped because Server Components may not set cookies —
 * in that context the middleware has already refreshed the session, so a
 * failed write here is expected and harmless.
 */
export async function getServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; the middleware owns the refresh.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — treat every call as privileged.
 *
 * Returns null rather than throwing so callers can degrade gracefully when
 * the key is absent (uploads disabled, for example) instead of 500ing.
 */
export function getServiceClient(): SupabaseClient | null {
  const serviceKey = getSupabaseServiceRoleKey();
  if (!serviceKey || !publicEnv.supabaseUrl) return null;

  return createClient(publicEnv.supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const MEDIA_BUCKET = 'hotel-media';

/** Public URL for an object in the media bucket. */
export function storagePublicUrl(path: string): string {
  if (path.startsWith('/') || path.startsWith('http')) return path;
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
}
