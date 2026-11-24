import { z } from "zod";
import { grantAccess, isEnrollmentActive, revokeAccess, sendAccessEmail } from "@/server/access";
import { findOrCreateStudent } from "@/server/accounts";
import { authenticateApiRequest, findProductByIdentifier, readBody } from "@/server/api-auth";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

const truthy = (value: unknown, fallback: boolean) =>
  value === undefined || value === null || value === "" ? fallback : !["false", "0", "no"].includes(String(value).toLowerCase());

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
  reference: z.string().trim().max(120).optional(),
  expires_at: z.string().trim().optional(),
});

function productIdentifiers(body: Record<string, unknown>) {
  const list = Array.isArray(body.products) ? body.products : [body.product ?? body.product_id ?? body.sku ?? body.slug];
  return list.map((item) => (item === undefined || item === null ? "" : String(item).trim())).filter(Boolean);
}

/**
 * POST /api/v1/enrollments — grant access after a purchase made on another platform.
 *
 *   { "email": "buyer@example.com", "name": "Buyer", "product": "<slug | SKU | id>",
 *     "reference": "order-123", "send_email": true, "expires_at": "2027-01-01" }
 *
 * Creates the student account when the email is new and emails them a one-click sign-in
 * link. Calling it again for the same person and product (or the same `reference`) changes
 * nothing, so webhook retries are safe.
 */
export async function POST(request: Request) {
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;

  const body = await readBody(request);
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "A valid `email` is required.", details: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const identifiers = productIdentifiers(body);
  if (identifiers.length === 0) {
    return Response.json({ error: "`product` is required: a product slug, SKU or id." }, { status: 400 });
  }

  let expiresAt: Date | null | undefined;
  if (parsed.data.expires_at) {
    const date = new Date(parsed.data.expires_at);
    if (Number.isNaN(date.getTime())) return Response.json({ error: "`expires_at` must be an ISO date." }, { status: 400 });
    expiresAt = date;
  }

  const products = [];
  for (const identifier of identifiers) {
    const product = await findProductByIdentifier(identifier);
    if (!product) return Response.json({ error: `No product matches "${identifier}".` }, { status: 404 });
    products.push(product);
  }

  const { user, created } = await findOrCreateStudent(parsed.data);
  if (user.status !== "ACTIVE") return Response.json({ error: "This account is suspended." }, { status: 409 });

  const sendEmail = truthy(body.send_email, true);
  const reference = parsed.data.reference;
  const results = [];

  for (const product of products) {
    const existing = await db.enrollment.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } });
    // A repeat of the same call (or one without a new reference) must not extend or re-notify.
    if (existing && isEnrollmentActive(existing) && (!reference || existing.externalRef === reference)) {
      results.push({ product: product.slug, status: "unchanged", expires_at: existing.expiresAt, license_key: existing.licenseKey });
      continue;
    }
    const { enrollment, outcome } = await grantAccess({
      userId: user.id,
      productId: product.id,
      source: "API",
      externalRef: reference ?? null,
      expiresAt,
    });
    if (reference && enrollment.externalRef !== reference) {
      await db.enrollment.update({ where: { id: enrollment.id }, data: { externalRef: reference } });
    }
    if (sendEmail && (outcome === "created" || outcome === "reactivated")) await sendAccessEmail(enrollment.id);
    results.push({ product: product.slug, status: outcome, expires_at: enrollment.expiresAt, license_key: enrollment.licenseKey });
  }

  await audit(null, "api.enrollment.grant", `API key "${caller.keyName}" granted ${user.email} access to ${products.map((p) => p.title).join(", ")}`, {
    entityType: "user",
    entityId: user.id,
  });

  return Response.json({ ok: true, user: { id: user.id, email: user.email, created }, enrollments: results }, { status: created ? 201 : 200 });
}

/** DELETE /api/v1/enrollments — remove access (for example after a refund). Body: { "email", "product" }. */
export async function DELETE(request: Request) {
  const caller = await authenticateApiRequest(request);
  if (caller instanceof Response) return caller;

  const body = await readBody(request);
  const email = String(body.email ?? new URL(request.url).searchParams.get("email") ?? "").trim().toLowerCase();
  const identifiers = productIdentifiers({ ...body, product: body.product ?? new URL(request.url).searchParams.get("product") });
  if (!email || identifiers.length === 0) return Response.json({ error: "`email` and `product` are required." }, { status: 400 });

  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!user) return Response.json({ error: "No student has that email address." }, { status: 404 });

  const results = [];
  for (const identifier of identifiers) {
    const product = await findProductByIdentifier(identifier);
    if (!product) return Response.json({ error: `No product matches "${identifier}".` }, { status: 404 });
    const enrollment = await db.enrollment.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } });
    if (!enrollment || enrollment.status === "REVOKED") {
      results.push({ product: product.slug, status: "not_enrolled" });
      continue;
    }
    await revokeAccess(enrollment.id, String(body.reason ?? "Revoked through the API").slice(0, 200));
    results.push({ product: product.slug, status: "revoked" });
  }

  await audit(null, "api.enrollment.revoke", `API key "${caller.keyName}" revoked access for ${user.email}`, { entityType: "user", entityId: user.id });
  return Response.json({ ok: true, enrollments: results });
}
