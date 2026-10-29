import 'server-only';

import { cookies } from 'next/headers';

import {
  getDemoAdminCredentials,
  getSessionSecret,
  isSupabaseConfigured,
} from '@/lib/env';
import { getServerClient } from '@/lib/supabase/clients';
import type { UserRole } from '@/lib/domain/types';
import { verifyPassword } from './password';
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from './session';

/**
 * Admin identity and authorisation.
 *
 * Two backends behind one surface:
 *
 *  - **Supabase Auth** when configured. The role is read from the `profiles`
 *    table on every request, never from a client-supplied claim — a JWT the
 *    browser holds cannot promote its own bearer.
 *  - **Signed cookie** in demo mode, using credentials from the environment.
 *
 * Every protected server action calls `requireRole` rather than trusting that
 * the middleware ran. Middleware is a convenience that keeps unauthenticated
 * visitors off admin pages; it is not the authorisation boundary, because a
 * server action can be invoked directly.
 */

export interface AdminIdentity {
  id: string;
  email: string;
  role: UserRole;
  /** Which backend authenticated this session. */
  source: 'supabase' | 'demo';
}

export class UnauthorizedError extends Error {
  override name = 'UnauthorizedError';
  constructor(message = 'Avtorizatsiya talab qilinadi.') {
    super(message);
  }
}

export class ForbiddenError extends Error {
  override name = 'ForbiddenError';
  constructor(message = 'Bu amal uchun ruxsat yoʻq.') {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* Reading the current identity                                                */
/* -------------------------------------------------------------------------- */

export async function getCurrentAdmin(): Promise<AdminIdentity | null> {
  if (isSupabaseConfigured()) return getSupabaseAdmin();
  return getDemoAdmin();
}

async function getSupabaseAdmin(): Promise<AdminIdentity | null> {
  try {
    const supabase = await getServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Authority comes from the database, not from the token.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return null;
    const role = profile.role as UserRole;
    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') return null;

    return {
      id: user.id,
      email: profile.email ?? user.email ?? '',
      role,
      source: 'supabase',
    };
  } catch (error) {
    console.error('[auth] supabase session lookup failed', error);
    return null;
  }
}

async function getDemoAdmin(): Promise<AdminIdentity | null> {
  let secret: string | null;
  try {
    secret = getSessionSecret();
  } catch {
    // A misconfigured secret must fail closed.
    return null;
  }
  if (!secret) return null;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifySessionToken(token, secret);
  if (!claims) return null;

  // The configured admin may have changed since the token was issued.
  const credentials = getDemoAdminCredentials();
  if (!credentials || credentials.email !== claims.email) return null;

  return {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    source: 'demo',
  };
}

/* -------------------------------------------------------------------------- */
/* Authorisation                                                               */
/* -------------------------------------------------------------------------- */

const ROLE_RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(identity: AdminIdentity, minimum: UserRole): boolean {
  return ROLE_RANK[identity.role] >= ROLE_RANK[minimum];
}

/**
 * Require an authenticated admin with at least `minimum` rank.
 *
 * Throws rather than returning null so a caller cannot forget to check the
 * result — an uncaught UnauthorizedError is a failed request, which is the
 * safe outcome.
 */
export async function requireRole(minimum: UserRole = 'editor'): Promise<AdminIdentity> {
  const identity = await getCurrentAdmin();
  if (!identity) throw new UnauthorizedError();
  if (!hasRole(identity, minimum)) throw new ForbiddenError();
  return identity;
}

/* -------------------------------------------------------------------------- */
/* Sign in / sign out                                                          */
/* -------------------------------------------------------------------------- */

export type SignInOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid_credentials' | 'not_configured' | 'error' };

export async function signIn(
  email: string,
  password: string,
): Promise<SignInOutcome> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, reason: 'invalid_credentials' };

      // Authenticating is not the same as being staff. A Supabase user with
      // no profile row has an account but no business in the admin area.
      const identity = await getSupabaseAdmin();
      if (!identity) {
        await supabase.auth.signOut();
        return { ok: false, reason: 'invalid_credentials' };
      }
      return { ok: true };
    } catch (error) {
      console.error('[auth] supabase sign-in failed', error);
      return { ok: false, reason: 'error' };
    }
  }

  const credentials = getDemoAdminCredentials();
  let secret: string | null = null;
  try {
    secret = getSessionSecret();
  } catch (error) {
    console.error('[auth]', error);
    return { ok: false, reason: 'not_configured' };
  }

  if (!credentials || !secret) return { ok: false, reason: 'not_configured' };

  const emailMatches = email.trim().toLowerCase() === credentials.email;
  // Always run the hash comparison, even when the email is wrong, so the
  // response time does not reveal whether an address is the configured one.
  const passwordMatches = await verifyPassword(password, credentials.passwordHash);

  if (!emailMatches || !passwordMatches) {
    return { ok: false, reason: 'invalid_credentials' };
  }

  const token = await createSessionToken(
    { sub: `demo:${credentials.email}`, email: credentials.email, role: 'admin' },
    secret,
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(await isSecureRequest()));

  return { ok: true };
}

/**
 * Is this request actually being served over HTTPS?
 *
 * Determined from the request rather than from `NODE_ENV`. A production build
 * served over plain HTTP — which is exactly what the end-to-end suite and a
 * local `npm start` do — would otherwise set `Secure` on the session cookie,
 * and the browser would silently drop it. The symptom is a login that appears
 * to succeed and then does nothing.
 *
 * `x-forwarded-proto` is set by the platform edge (Vercel sets it and strips
 * any client-supplied value). Falling back to `false` is the safe direction:
 * it may omit `Secure` on an unusual proxy, never add it where the browser
 * would reject the cookie outright.
 */
async function isSecureRequest(): Promise<boolean> {
  const { headers } = await import('next/headers');
  const requestHeaders = await headers();

  const forwardedProto = requestHeaders.get('x-forwarded-proto');
  if (forwardedProto) {
    return forwardedProto.split(',')[0]?.trim() === 'https';
  }

  // No proxy header: trust the origin the browser reported.
  const origin = requestHeaders.get('origin') ?? requestHeaders.get('referer');
  return Boolean(origin?.startsWith('https://'));
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await getServerClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error('[auth] supabase sign-out failed', error);
    }
    return;
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Is any admin backend usable at all? Drives the login page's guidance. */
export function isAuthConfigured(): boolean {
  if (isSupabaseConfigured()) return true;
  try {
    return Boolean(getDemoAdminCredentials() && getSessionSecret());
  } catch {
    return false;
  }
}
