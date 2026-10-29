import 'server-only';

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing for demo-mode admin credentials.
 *
 * scrypt from Node's standard library, with parameters chosen to take roughly
 * 100ms on a typical serverless CPU — slow enough to make offline guessing
 * expensive, fast enough that a sign-in does not feel broken.
 *
 * The hash is self-describing (`scrypt$N$r$p$salt$hash`) so the cost can be
 * raised later without invalidating existing hashes: an old hash still
 * verifies against the parameters it was created with.
 *
 * When Supabase is configured this file is unused — Supabase Auth owns
 * credentials and this project never sees a password.
 */

const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
// scrypt needs roughly 128 * N * r bytes; Node's default cap is below that.
const MAX_MEM = 128 * DEFAULT_PARAMS.N * DEFAULT_PARAMS.r * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...DEFAULT_PARAMS,
    maxmem: MAX_MEM,
  });

  return [
    'scrypt',
    DEFAULT_PARAMS.N,
    DEFAULT_PARAMS.r,
    DEFAULT_PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false for a malformed hash rather than throwing, so a corrupted
 * environment variable produces a failed sign-in rather than a 500 that
 * reveals the configuration is broken.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts as [
      string, string, string, string, string, string,
    ];

    const N = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
      return false;
    }
    // Guard against a hostile hash string demanding absurd memory.
    if (N > 2 ** 20 || r > 32 || p > 16) return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scryptAsync(
      password.normalize('NFKC'),
      salt,
      expected.length,
      { N, r, p, maxmem: 128 * N * r * 2 },
    );

    // Constant-time: a length check first, because timingSafeEqual throws on
    // a mismatch and that throw would itself leak length.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
