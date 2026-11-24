import "server-only";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";

export type ApiCaller = { keyId: string; keyName: string };

/**
 * Authenticates a public API request with a key created in Admin → Integrations.
 * The key can be sent as `Authorization: Bearer <key>`, `X-API-Key: <key>`, or — for tools
 * that can't set headers — as `?api_key=<key>`.
 */
export async function authenticateApiRequest(request: Request): Promise<ApiCaller | Response> {
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const key =
    (header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null) ??
    request.headers.get("x-api-key")?.trim() ??
    url.searchParams.get("api_key")?.trim();

  if (!key) return Response.json({ error: "Missing API key." }, { status: 401 });

  const record = await db.apiKey.findUnique({ where: { keyHash: sha256(key) } });
  if (!record || record.revokedAt) return Response.json({ error: "Invalid or revoked API key." }, { status: 401 });

  const limit = await rateLimit(`api:${record.id}`, 300, 60);
  if (!limit.ok) {
    return Response.json(
      { error: "Too many requests. Slow down and retry." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  // Fire-and-forget: a failed timestamp update must not fail the request.
  db.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { keyId: record.id, keyName: record.name };
}

/** Reads a JSON or form-encoded body into a plain object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const data = await request.json();
      return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    }
    if (type.includes("form")) return Object.fromEntries((await request.formData()).entries());
    const text = await request.text();
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Finds a product by id, slug or SKU / external product ID. */
export async function findProductByIdentifier(identifier: string) {
  const value = identifier.trim();
  if (!value) return null;
  return db.product.findFirst({
    where: { OR: [{ id: value }, { slug: value }, { sku: value }], status: { not: "ARCHIVED" } },
    select: { id: true, slug: true, sku: true, title: true, type: true, status: true },
  });
}
