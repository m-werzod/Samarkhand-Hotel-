import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit and integration tests run in the Node environment against the domain
 * and data layers — the code where a mistake costs a guest money or exposes
 * their details.
 *
 * There is no JSX transform configured because there are no component tests
 * here: the UI is covered end to end by Playwright, against a real browser,
 * which is a better signal than asserting on a virtual DOM.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws when imported outside a Server Component. These
      // tests exercise those modules directly, so it is stubbed out.
      'server-only': fileURLToPath(
        new URL('./tests/stubs/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      // The Supabase adapter needs a live database to mean anything; it is
      // covered by the integration suite when one is configured.
      exclude: ['src/lib/data/supabase-store.ts', 'src/lib/supabase/**'],
    },
  },
});
