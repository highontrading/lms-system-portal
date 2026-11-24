import "server-only";
import type { Enrollment } from "@/generated/prisma/client";
import { fromLocalInputValue } from "@/lib/dates";
import { grantAccess, isEnrollmentActive, sendAccessEmail } from "@/server/access";
import { findOrCreateStudent } from "@/server/accounts";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";

export type AccessStatus = "active" | "expired" | "revoked";

export function accessStatus(enrollment: Pick<Enrollment, "status" | "expiresAt">, now = new Date()): AccessStatus {
  if (enrollment.status === "REVOKED") return "revoked";
  return isEnrollmentActive(enrollment, now) ? "active" : "expired";
}

/** "2026-12-31" → the last minute of that day in the site's time zone. */
export async function endOfDayInSiteZone(day: string) {
  const { general } = await loadSettings();
  return fromLocalInputValue(`${day}T23:59`, general.timezone);
}

/**
 * Expiry choices offered in the admin forms:
 *  - "" / undefined → the product's default access period
 *  - "lifetime"     → never expires
 *  - "YYYY-MM-DD"   → until the end of that day
 */
export async function parseExpiryChoice(value: string | null | undefined): Promise<Date | null | undefined> {
  if (!value) return undefined;
  if (value === "lifetime") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return (await endOfDayInSiteZone(value)) ?? undefined;
}

/** Grants a product to an email address, creating a password-less student account when needed. */
export async function grantToEmail(input: {
  email: string;
  name?: string | null;
  productId: string;
  expiresAt?: Date | null;
  source: "MANUAL" | "IMPORT";
  sendEmail: boolean;
}) {
  const { user, created } = await findOrCreateStudent({ email: input.email, name: input.name });
  const { enrollment, outcome } = await grantAccess({
    userId: user.id,
    productId: input.productId,
    source: input.source,
    expiresAt: input.expiresAt,
  });
  if (input.sendEmail && (outcome === "created" || outcome === "reactivated")) {
    await sendAccessEmail(enrollment.id);
  }
  return { user, created, enrollment, outcome };
}

export type ProductOption = { id: string; title: string; type: string; slug: string; sku: string | null };

/** Products that access can be granted to (everything except archived ones). */
export async function productOptions(): Promise<ProductOption[]> {
  return db.product.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, title: true, type: true, slug: true, sku: true },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });
}
