import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}


const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Hashes a password using scrypt (Node built-in, memory-hard). Format:
 *   scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 * No plaintext password is ever stored or logged.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_PARAMS)) as Buffer;
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verifies a password against a stored hash using a constant-time comparison.
 * Returns false on any malformed hash rather than throwing.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) {
    return false;
  }

  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  const params = { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) };

  if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");

  try {
    const derived = (await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, params)) as Buffer;

    if (derived.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
