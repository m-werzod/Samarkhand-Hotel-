import 'server-only';

import { isSupabaseConfigured } from '@/lib/env';
import { DemoStore } from './demo-store';
import { SupabaseStore } from './supabase-store';
import type { DataStore } from './store';

/**
 * Picks the backend once per process.
 *
 * The decision is made from configuration alone, never from a request, so a
 * visitor cannot influence which store answers them.
 */
let cached: DataStore | null = null;

export function getStore(): DataStore {
  cached ??= isSupabaseConfigured() ? new SupabaseStore() : new DemoStore();
  return cached;
}

/** Test seam: drop the cached instance so a test can switch modes. */
export function resetStoreCache(): void {
  cached = null;
}

export * from './store';
