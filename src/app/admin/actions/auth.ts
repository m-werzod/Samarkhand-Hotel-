'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { signIn, signOut } from '@/lib/auth';
import { RATE_LIMITS, clientKey, rateLimit } from '@/lib/security/rate-limit';
import { adminLoginSchema } from '@/lib/validation/schemas';

export interface LoginResult {
  ok: boolean;
  message: string;
  /** Where to send the browser on success. Always a same-site path. */
  redirectTo?: string;
}

/**
 * Admin sign-in.
 *
 * The failure message is identical for an unknown email, a wrong password and
 * a user without a staff profile. Distinguishing them would turn the login
 * form into an account-enumeration oracle.
 */
export async function loginAction(
  input: unknown,
  nextPath?: string,
): Promise<LoginResult> {
  const requestHeaders = await headers();

  const limit = rateLimit(clientKey(requestHeaders, 'login'), RATE_LIMITS.adminLogin);
  if (!limit.allowed) {
    return {
      ok: false,
      message: `Juda koʻp urinish. ${Math.ceil(limit.retryAfter / 60)} daqiqadan soʻng qayta urinib koʻring.`,
    };
  }

  const parsed = adminLoginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Email yoki parol notoʻgʻri.' };
  }

  const outcome = await signIn(parsed.data.email, parsed.data.password);

  if (!outcome.ok) {
    if (outcome.reason === 'not_configured') {
      return {
        ok: false,
        message:
          'Administrator hisobi sozlanmagan. ADMIN_EMAIL, ADMIN_PASSWORD_HASH va ADMIN_SESSION_SECRET qiymatlarini kiriting.',
      };
    }
    return { ok: false, message: 'Email yoki parol notoʻgʻri.' };
  }

  return { ok: true, message: 'Kirildi.', redirectTo: safeRedirect(nextPath) };
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/admin/login');
}

/**
 * Only same-site admin paths are honoured.
 *
 * Without this, `?next=https://evil.example` would make the login form a
 * redirect gadget on a domain visitors are being asked to trust.
 */
function safeRedirect(path: string | undefined): string {
  if (!path) return '/admin';
  if (!path.startsWith('/admin')) return '/admin';
  if (path.startsWith('//')) return '/admin';
  if (path.includes('\\')) return '/admin';
  return path;
}
