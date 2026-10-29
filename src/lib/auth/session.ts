import { SignJWT, jwtVerify } from 'jose';

import type { UserRole } from '@/lib/domain/types';

/**
 * Signed admin sessions for demo mode.
 *
 * A compact JWT in an httpOnly, SameSite=Lax, Secure cookie. The token is
 * signed, not encrypted — it carries no secret, only an email, a role and an
 * expiry, and the signature is what makes it unforgeable.
 *
 * Deliberately Edge-compatible (jose, Web Crypto) so the middleware can
 * verify a session without pulling the Node runtime into every request.
 */

export const SESSION_COOKIE = 'samarkhand_admin';
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // one working day

export interface SessionClaims {
  sub: string;
  email: string;
  role: UserRole;
}

const ISSUER = 'samarkhand-hotel';
const AUDIENCE = 'samarkhand-admin';

function keyFrom(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  claims: SessionClaims,
  secret: string,
): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(keyFrom(secret));
}

/**
 * Verify a session token.
 *
 * Returns null on any failure — expired, wrong signature, wrong issuer,
 * malformed. Callers treat null as "not signed in"; there is no path where a
 * partially valid token grants partial access.
 */
export async function verifySessionToken(
  token: string,
  secret: string,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, keyFrom(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });

    const email = typeof payload.email === 'string' ? payload.email : null;
    const role = payload.role;
    const sub = payload.sub;

    if (!email || !sub) return null;
    if (role !== 'admin' && role !== 'editor' && role !== 'viewer') return null;

    return { sub, email, role };
  } catch {
    return null;
  }
}

/** Cookie attributes. Secure is dropped on http so local dev still works. */
export function sessionCookieOptions(isSecure: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isSecure,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
