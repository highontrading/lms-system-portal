import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSha256(secret: string, payload: string | Buffer) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomDigits(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) out += randomInt(0, 10).toString();
  return out;
}

// No 0/O/1/I/L so codes survive being read aloud or typed from a screenshot.
const READABLE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomReadable(length: number) {
  let out = "";
  for (let i = 0; i < length; i++) out += READABLE[randomInt(0, READABLE.length)];
  return out;
}

/** "K7QM-2XPA-9RHT-4CWE" */
export function generateLicenseKey() {
  return [0, 1, 2, 3].map(() => randomReadable(4)).join("-");
}

// ───────────────────── Encryption for stored credentials ─────────────────────

const DEV_SECRET = "ideabro-academy-development-secret";
let warnedAboutSecret = false;

export function appSecret() {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set to a random string of at least 16 characters in production.");
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("[ideabro] APP_SECRET is not set — using an insecure development secret.");
  }
  return DEV_SECRET;
}

function encryptionKey() {
  return createHash("sha256").update(`enc:${appSecret()}`).digest();
}

const PREFIX = "enc:v1:";

export function isEncrypted(value: string | null | undefined) {
  return !!value && value.startsWith(PREFIX);
}

/** AES-256-GCM. Used for payment and email credentials saved from the admin panel. */
export function encryptSecret(plain: string) {
  if (!plain) return "";
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    // Wrong APP_SECRET or corrupted value: treat as "not configured" rather than crashing a page.
    return "";
  }
}

/** HMAC bound to APP_SECRET, for short-lived signed URLs and tokens that need no database row. */
export function signValue(value: string) {
  return hmacSha256(`sig:${appSecret()}`, value);
}

export function verifySignedValue(value: string, signature: string) {
  return safeEqual(signValue(value), signature);
}
