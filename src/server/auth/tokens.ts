import "server-only";
import type { TokenType } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { randomDigits, randomToken, safeEqual, sha256 } from "@/server/crypto";

const MAX_CODE_ATTEMPTS = 5;

function codeDigest(email: string, code: string) {
  return sha256(`${email.toLowerCase()}:${code}`);
}

/**
 * Creates a single-use token (and optionally a 6-digit code) for an email address.
 * Any earlier unused token of the same kind for that address stops working.
 */
export async function issueToken(input: {
  type: TokenType;
  email: string;
  userId?: string | null;
  ttlMinutes: number;
  withCode?: boolean;
  /** Keep earlier tokens valid — used for invites, where several emails may be in flight at once. */
  keepExisting?: boolean;
}) {
  const email = input.email.toLowerCase();
  const token = randomToken(32);
  const code = input.withCode ? randomDigits(6) : null;

  await db.$transaction([
    db.authToken.deleteMany({
      where: input.keepExisting
        ? { email, type: input.type, expiresAt: { lt: new Date() } }
        : { email, type: input.type, usedAt: null },
    }),
    db.authToken.create({
      data: {
        type: input.type,
        email,
        userId: input.userId ?? null,
        tokenHash: sha256(token),
        codeHash: code ? codeDigest(email, code) : null,
        expiresAt: new Date(Date.now() + input.ttlMinutes * 60_000),
      },
    }),
  ]);

  return { token, code };
}

/** Looks a link token up without using it (e.g. to decide whether to show the reset form). */
export async function peekToken(type: TokenType, token: string) {
  if (!token) return null;
  const record = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  return record;
}

/** Validates and burns a link token. Returns the record when it was valid. */
export async function consumeToken(type: TokenType, token: string) {
  const record = await peekToken(type, token);
  if (!record) return null;
  // Guard against two requests racing to use the same token.
  const result = await db.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1 ? record : null;
}

/** Validates and burns a 6-digit sign-in code for an email address. */
export async function consumeCode(type: TokenType, emailInput: string, code: string) {
  const email = emailInput.toLowerCase();
  const record = await db.authToken.findFirst({
    where: { email, type, usedAt: null, expiresAt: { gt: new Date() }, codeHash: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || !record.codeHash || record.attempts >= MAX_CODE_ATTEMPTS) return null;

  if (!safeEqual(record.codeHash, codeDigest(email, code.trim()))) {
    await db.authToken.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return null;
  }

  const result = await db.authToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return result.count === 1 ? record : null;
}

export async function purgeExpiredTokens() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
  await db.authToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
