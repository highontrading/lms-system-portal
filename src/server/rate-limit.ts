import "server-only";
import { db } from "@/server/db";
import { requestMeta } from "@/server/url";

type Row = { count: number; resetAt: Date };

/**
 * Fixed-window counter stored in PostgreSQL, so limits hold across serverless instances.
 * Returns `ok: false` once `limit` hits have been recorded inside the window.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.$queryRaw<Row[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now()
        THEN now() + make_interval(secs => ${windowSeconds})
        ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;
  const row = rows[0];
  const retryAfter = row ? Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)) : windowSeconds;
  return { ok: !row || row.count <= limit, retryAfter };
}

/**
 * Rate limit keyed by the caller's IP address. When the address isn't known (no proxy header),
 * this limit is skipped rather than throttling every visitor through one shared bucket —
 * the per-account limits still apply.
 */
export async function rateLimitByIp(scope: string, limit: number, windowSeconds: number) {
  const { ip } = await requestMeta();
  if (!ip) return { ok: true, retryAfter: 0 };
  return rateLimit(`${scope}:${ip}`, limit, windowSeconds);
}

export function retryMessage(retryAfter: number) {
  const minutes = Math.ceil(retryAfter / 60);
  return minutes <= 1
    ? "Too many attempts. Please wait a minute and try again."
    : `Too many attempts. Please try again in ${minutes} minutes.`;
}
