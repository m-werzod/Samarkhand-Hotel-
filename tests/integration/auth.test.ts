import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
} from '@/lib/auth/session';
import { rateLimit } from '@/lib/security/rate-limit';
import { randomId } from '@/lib/utils';

const SECRET = 'a'.repeat(48);
const OTHER_SECRET = 'b'.repeat(48);

describe('password hashing', () => {
  it('produces a self-describing scrypt hash', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('never stores the password itself', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it('salts, so the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(a).not.toBe(b);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('s3cret-password');
    expect(await verifyPassword('s3cret-password', hash)).toBe(true);
    expect(await verifyPassword('s3cret-passwore', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('normalises Unicode so an equivalent password still verifies', async () => {
    // Composed vs decomposed form of the same string.
    const hash = await hashPassword('pañol-123456');
    expect(await verifyPassword('pañol-123456', hash)).toBe(true);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    for (const bad of ['', 'not-a-hash', 'scrypt$1$2$3', 'bcrypt$1$8$1$a$b']) {
      expect(await verifyPassword('any', bad), bad).toBe(false);
    }
  });

  it('refuses hash parameters that would demand absurd memory', async () => {
    const hostile = `scrypt$${2 ** 25}$64$32$YQ==$Yg==`;
    expect(await verifyPassword('any', hostile)).toBe(false);
  });
});

describe('session tokens', () => {
  const claims = { sub: 'demo:admin@example.com', email: 'admin@example.com', role: 'admin' as const };

  it('round-trips valid claims', async () => {
    const token = await createSessionToken(claims, SECRET);
    expect(await verifySessionToken(token, SECRET)).toEqual(claims);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(claims, SECRET);
    expect(await verifySessionToken(token, OTHER_SECRET)).toBeNull();
  });

  it('rejects a tampered payload', async () => {
    const token = await createSessionToken(claims, SECRET);
    const [header, payload, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...claims, role: 'admin', email: 'attacker@example.com' }),
    ).toString('base64url');
    expect(
      await verifySessionToken(`${header}.${forged}.${signature}`, SECRET),
    ).toBeNull();
    expect(payload).toBeTruthy();
  });

  it('rejects garbage', async () => {
    for (const bad of ['', 'abc', 'a.b.c']) {
      expect(await verifySessionToken(bad, SECRET), bad).toBeNull();
    }
  });

  it('rejects an unknown role rather than defaulting to one', async () => {
    const token = await createSessionToken(
      { ...claims, role: 'superuser' as unknown as 'admin' },
      SECRET,
    );
    expect(await verifySessionToken(token, SECRET)).toBeNull();
  });

  it('expires within a working day', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBeLessThanOrEqual(12 * 60 * 60);
  });
});

describe('rate limiting', () => {
  it('allows up to the limit and then refuses', () => {
    const key = `test-${randomId(8)}`;
    const options = { limit: 3, windowMs: 60_000 };

    expect(rateLimit(key, options).allowed).toBe(true);
    expect(rateLimit(key, options).allowed).toBe(true);
    const third = rateLimit(key, options);
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = rateLimit(key, options);
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfter).toBeGreaterThan(0);
  });

  it('counts each key independently', () => {
    const options = { limit: 1, windowMs: 60_000 };
    const a = `test-${randomId(8)}`;
    const b = `test-${randomId(8)}`;

    expect(rateLimit(a, options).allowed).toBe(true);
    expect(rateLimit(a, options).allowed).toBe(false);
    expect(rateLimit(b, options).allowed).toBe(true);
  });

  it('resets once the window has passed', async () => {
    const key = `test-${randomId(8)}`;
    const options = { limit: 1, windowMs: 20 };

    expect(rateLimit(key, options).allowed).toBe(true);
    expect(rateLimit(key, options).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rateLimit(key, options).allowed).toBe(true);
  });
});

describe('identifier generation', () => {
  it('produces identifiers of the requested length', () => {
    expect(randomId(6)).toHaveLength(6);
    expect(randomId(32)).toHaveLength(32);
  });

  it('uses only the unambiguous alphabet', () => {
    const sample = Array.from({ length: 500 }, () => randomId(16)).join('');
    expect(sample).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it('does not repeat across a large sample', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => randomId(16)));
    expect(ids.size).toBe(5000);
  });
});
