import { isNonEmptyString } from './utils';

/**
 * Environment configuration.
 *
 * The platform runs in one of two modes and says which, loudly:
 *
 *  - **supabase** — a real Postgres database, real auth, real object storage.
 *    Requires the Supabase variables below.
 *  - **demo** — an in-memory store seeded from `src/lib/data/seed.ts`, used
 *    when no database is configured. Everything works, but writes do not
 *    survive a server restart and are not shared between serverless
 *    instances. The UI says so; nothing pretends a database is connected.
 *
 * Secrets are only read in modules that never reach the client. The three
 * `NEXT_PUBLIC_` values are safe by design: the Supabase anon key is
 * protected by Row Level Security, not by secrecy.
 */

export type RuntimeMode = 'supabase' | 'demo';

function readPublic(name: string): string | null {
  // Next.js inlines NEXT_PUBLIC_* at build time, so these must be referenced
  // as static property accesses rather than through a dynamic key.
  const values: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  };
  const value = values[name];
  return isNonEmptyString(value) ? value.trim() : null;
}

export const publicEnv = {
  supabaseUrl: readPublic('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: readPublic('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  siteUrl: readPublic('NEXT_PUBLIC_SITE_URL'),
} as const;

/** Supabase is only considered configured when both halves are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function getRuntimeMode(): RuntimeMode {
  return isSupabaseConfigured() ? 'supabase' : 'demo';
}

export function isDemoMode(): boolean {
  return getRuntimeMode() === 'demo';
}

/**
 * The canonical site origin, used for canonical URLs, sitemaps and Open
 * Graph tags.
 *
 * Falls back to the Vercel-provided URL, then to localhost, so a preview
 * deployment still emits coherent metadata instead of broken absolute links.
 */
export function getSiteUrl(): string {
  if (publicEnv.siteUrl) return stripTrailingSlash(publicEnv.siteUrl);

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (isNonEmptyString(vercelUrl)) {
    return `https://${stripTrailingSlash(vercelUrl.trim())}`;
  }

  return 'http://localhost:3000';
}

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/* -------------------------------------------------------------------------- */
/* Server-only secrets                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Reads a server-side secret. Returns null rather than throwing so a missing
 * integration degrades into a documented "not configured" state instead of
 * crashing the whole site.
 */
export function serverSecret(name: string): string | null {
  const value = process.env[name];
  return isNonEmptyString(value) ? value.trim() : null;
}

export interface DemoAdminCredentials {
  email: string;
  /** scrypt hash in the form `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`. */
  passwordHash: string;
}

/**
 * Demo-mode admin credentials.
 *
 * There is no default account and no fallback password. If these are unset,
 * the admin area cannot be signed into at all — which is the correct
 * behaviour for a deployment nobody has provisioned yet.
 *
 * See `npm run admin:hash` and docs/DEPLOYMENT.md.
 */
export function getDemoAdminCredentials(): DemoAdminCredentials | null {
  const email = serverSecret('ADMIN_EMAIL');
  const passwordHash = serverSecret('ADMIN_PASSWORD_HASH');
  if (!email || !passwordHash) return null;
  return { email: email.toLowerCase(), passwordHash };
}

/**
 * Secret used to sign admin session cookies in demo mode.
 *
 * Intentionally has no fallback: a predictable signing key is the same as no
 * authentication at all.
 */
export function getSessionSecret(): string | null {
  const secret = serverSecret('ADMIN_SESSION_SECRET');
  if (!secret) return null;
  if (secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48',
    );
  }
  return secret;
}

export function getSupabaseServiceRoleKey(): string | null {
  return serverSecret('SUPABASE_SERVICE_ROLE_KEY');
}

/* -------------------------------------------------------------------------- */
/* Integration readiness                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A single place to answer "what is actually wired up?".
 *
 * The admin dashboard renders this verbatim so an operator can see at a
 * glance which integrations are live and which are still placeholders,
 * rather than discovering it when a guest does not get an email.
 */
export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
}

export function getIntegrationStatuses(): IntegrationStatus[] {
  const supabase = isSupabaseConfigured();
  return [
    {
      key: 'database',
      label: 'Maʼlumotlar bazasi (Supabase Postgres)',
      configured: supabase,
      detail: supabase
        ? 'Supabase ulangan. Barcha yozuvlar bazada saqlanadi.'
        : 'Demo rejim: maʼlumotlar faqat xotirada saqlanadi va server qayta ishga tushganda tiklanadi.',
    },
    {
      key: 'auth',
      label: 'Administrator autentifikatsiyasi',
      configured: supabase || Boolean(getDemoAdminCredentials() && getSessionSecretSafe()),
      detail: supabase
        ? 'Supabase Auth ishlatilmoqda.'
        : getDemoAdminCredentials() && getSessionSecretSafe()
          ? 'Demo rejim: ADMIN_EMAIL va ADMIN_PASSWORD_HASH orqali imzolangan sessiya.'
          : 'Sozlanmagan: ADMIN_EMAIL, ADMIN_PASSWORD_HASH va ADMIN_SESSION_SECRET kerak.',
    },
    {
      key: 'storage',
      label: 'Media saqlash (Supabase Storage)',
      configured: supabase && Boolean(getSupabaseServiceRoleKey()),
      detail:
        supabase && getSupabaseServiceRoleKey()
          ? 'Yuklangan fayllar Supabase Storage’da saqlanadi.'
          : 'Sozlanmagan: fayl yuklash oʻchirilgan, faqat mavjud media ishlatiladi.',
    },
    {
      key: 'email',
      label: 'Email xabarnomalari',
      configured: Boolean(serverSecret('RESEND_API_KEY')),
      detail: serverSecret('RESEND_API_KEY')
        ? 'Email provayderi ulangan.'
        : 'Sozlanmagan: xabarnomalar faqat server jurnaliga yoziladi, email yuborilmaydi.',
    },
    {
      key: 'telegram',
      label: 'Telegram xabarnomalari',
      configured: Boolean(
        serverSecret('TELEGRAM_BOT_TOKEN') && serverSecret('TELEGRAM_CHAT_ID'),
      ),
      detail:
        serverSecret('TELEGRAM_BOT_TOKEN') && serverSecret('TELEGRAM_CHAT_ID')
          ? 'Telegram boti ulangan.'
          : 'Sozlanmagan: xabarnomalar faqat server jurnaliga yoziladi.',
    },
  ];
}

/** Non-throwing variant for the status panel, which must never 500. */
function getSessionSecretSafe(): string | null {
  try {
    return getSessionSecret();
  } catch {
    return null;
  }
}
