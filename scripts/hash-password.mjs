#!/usr/bin/env node
/**
 * Generates an ADMIN_PASSWORD_HASH for demo-mode admin access.
 *
 *   npm run admin:hash
 *
 * Reads the password from stdin rather than argv on purpose: a password on
 * the command line ends up in shell history and in the process list, where
 * any other user on the machine can read it.
 *
 * The hash this prints is safe to commit to an environment-variable store.
 * The password itself is never written anywhere by this script.
 */
import { createInterface } from 'node:readline';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const KEY_LENGTH = 64;
const MAX_MEM = 128 * PARAMS.N * PARAMS.r * 2;

const MIN_LENGTH = 12;

function prompt(question, { silent = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    if (silent && process.stdin.isTTY) {
      // Suppress echo so the password is not shown or left on screen.
      const onData = (char) => {
        const s = String(char);
        if (s === '\n' || s === '\r' || s === '\u0004') {
          process.stdin.removeListener('data', onData);
        } else {
          process.stdout.write('\u001b[2K\u001b[200D' + question + '*'.repeat(rl.line.length));
        }
      };
      process.stdin.on('data', onData);
    }

    rl.question(question, (answer) => {
      rl.close();
      if (silent) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\nSamarkhand Hotel — administrator parol hashi\n');

  const password = await prompt('Parol: ', { silent: true });
  if (password.length < MIN_LENGTH) {
    console.error(`\nParol kamida ${MIN_LENGTH} ta belgidan iborat boʻlishi kerak.`);
    process.exitCode = 1;
    return;
  }

  const confirm = await prompt('Parolni takrorlang: ', { silent: true });
  if (password !== confirm) {
    console.error('\nParollar mos kelmadi.');
    process.exitCode = 1;
    return;
  }

  const salt = randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    ...PARAMS,
    maxmem: MAX_MEM,
  });

  const hash = [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');

  const sessionSecret = randomBytes(48).toString('base64');

  console.log('\nQuyidagilarni .env.local fayliga yoki Vercel environment');
  console.log('variables boʻlimiga qoʻshing:\n');
  console.log(`ADMIN_EMAIL=siz@example.com`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
  console.log('\nParolning oʻzi hech qayerga saqlanmadi.\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
