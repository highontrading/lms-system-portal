import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt with N=2^15 costs ~32 MB and a few tens of milliseconds per hash on server hardware.
const COST = 1 << 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, cost: number, blockSize: number, parallelism: number, length: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      length,
      { N: cost, r: blockSize, p: parallelism, maxmem: 256 * cost * blockSize },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password.normalize("NFKC"), salt, COST, BLOCK_SIZE, PARALLELISM, KEY_LENGTH);
  return ["scrypt", COST, BLOCK_SIZE, PARALLELISM, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [scheme, cost, blockSize, parallelism, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64");
    const actual = await derive(
      password.normalize("NFKC"),
      Buffer.from(salt, "base64"),
      Number(cost),
      Number(blockSize),
      Number(parallelism),
      expected.length,
    );
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 8;

/** Returns a message when the password is unacceptable, otherwise null. */
export function passwordProblem(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > 200) return "That password is too long.";
  if (/^(.)\1+$/.test(password)) return "Choose a password that isn't a single repeated character.";
  return null;
}
