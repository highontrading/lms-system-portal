import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Enrollment } from "@/generated/prisma/client";
import type { EnrollmentSource } from "@/generated/prisma/enums";
import { addDays } from "@/lib/dates";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { issueToken } from "@/server/auth/tokens";
import { generateLicenseKey } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { loadSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";
import { emitEvent } from "@/server/webhooks";

type EnrollmentLike = Pick<Enrollment, "status" | "expiresAt">;

/** An enrolment grants access while it is active and not past its end date. */
export function isEnrollmentActive(enrollment: EnrollmentLike | null | undefined, now = new Date()) {
  return !!enrollment && enrollment.status === "ACTIVE" && (!enrollment.expiresAt || enrollment.expiresAt > now);
}

export type AccessState = {
  enrollment: Enrollment | null;
  active: boolean;
  /** Had access before, but it has ended or was revoked. */
  lapsed: boolean;
};

export async function getAccess(userId: string | null | undefined, productId: string): Promise<AccessState> {
  if (!userId) return { enrollment: null, active: false, lapsed: false };
  const enrollment = await db.enrollment.findUnique({ where: { userId_productId: { userId, productId } } });
  const active = isEnrollmentActive(enrollment);
  return { enrollment, active, lapsed: !!enrollment && !active };
}

export type GrantInput = {
  userId: string;
  productId: string;
  source: EnrollmentSource;
  orderId?: string | null;
  bundleId?: string | null;
  note?: string | null;
  externalRef?: string | null;
  /** undefined = the product's default duration · null = lifetime · a date = until then */
  expiresAt?: Date | null;
  /** Add an item to the student's notification inbox (default true). */
  notify?: boolean;
};

export type GrantOutcome = "created" | "reactivated" | "extended" | "unchanged";

export type GrantResult = { enrollment: Enrollment; outcome: GrantOutcome };

/** Later of two end dates, where null means "never expires". */
function laterExpiry(a: Date | null, b: Date | null) {
  if (a === null || b === null) return null;
  return a > b ? a : b;
}

/**
 * The single place access is granted from — purchases, free enrolments, admin grants, CSV
 * imports and the API all come through here. Safe to call repeatedly for the same user and
 * product: an existing active enrolment is kept (and extended when a time-limited product is
 * bought again) rather than duplicated.
 */
export async function grantAccess(input: GrantInput): Promise<GrantResult> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      type: true,
      title: true,
      slug: true,
      accessDays: true,
      licenseKeysEnabled: true,
      bundleItems: { select: { productId: true }, orderBy: { position: "asc" } },
    },
  });
  if (!product) throw new Error(`Product ${input.productId} does not exist`);

  const now = new Date();
  const defaultExpiry = product.accessDays ? addDays(now, product.accessDays) : null;
  const requestedExpiry = input.expiresAt !== undefined ? input.expiresAt : defaultExpiry;
  const key = { userId_productId: { userId: input.userId, productId: product.id } };

  let enrollment = await db.enrollment.findUnique({ where: key });
  let outcome: GrantOutcome;

  if (!enrollment) {
    try {
      enrollment = await db.enrollment.create({
        data: {
          userId: input.userId,
          productId: product.id,
          source: input.source,
          orderId: input.orderId ?? null,
          bundleId: input.bundleId ?? null,
          note: input.note ?? null,
          externalRef: input.externalRef ?? null,
          expiresAt: requestedExpiry,
          licenseKey: product.licenseKeysEnabled ? generateLicenseKey() : null,
        },
      });
      outcome = "created";
    } catch (error) {
      // Two grants raced (e.g. payment callback and webhook). The other one won; carry on from its row.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      enrollment = await db.enrollment.findUniqueOrThrow({ where: key });
      outcome = "unchanged";
    }
  } else if (!isEnrollmentActive(enrollment, now)) {
    enrollment = await db.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "ACTIVE",
        revokedAt: null,
        source: input.source,
        orderId: input.orderId ?? null,
        bundleId: input.bundleId ?? null,
        note: input.note ?? enrollment.note,
        externalRef: input.externalRef ?? enrollment.externalRef,
        expiresAt: requestedExpiry,
        licenseKey: enrollment.licenseKey ?? (product.licenseKeysEnabled ? generateLicenseKey() : null),
      },
    });
    outcome = "reactivated";
  } else {
    let expiresAt = enrollment.expiresAt;
    if (input.source === "BUNDLE") {
      // Access through a bundle never shortens access the student already holds directly.
      expiresAt = laterExpiry(enrollment.expiresAt, requestedExpiry);
    } else if (input.expiresAt !== undefined) {
      expiresAt = input.expiresAt;
    } else if (enrollment.expiresAt && product.accessDays && (input.source === "PURCHASE" || input.source === "API")) {
      // Buying a time-limited product again renews it from the current end date.
      expiresAt = addDays(enrollment.expiresAt, product.accessDays);
    } else if (enrollment.expiresAt && !product.accessDays) {
      expiresAt = null;
    }

    const expiryChanged = (expiresAt?.getTime() ?? null) !== (enrollment.expiresAt?.getTime() ?? null);
    const upgradeFromBundle = enrollment.source === "BUNDLE" && input.source !== "BUNDLE";
    const needsLicense = product.licenseKeysEnabled && !enrollment.licenseKey;

    if (expiryChanged || upgradeFromBundle || needsLicense) {
      enrollment = await db.enrollment.update({
        where: { id: enrollment.id },
        data: {
          expiresAt,
          ...(upgradeFromBundle ? { source: input.source, bundleId: null, orderId: input.orderId ?? enrollment.orderId } : {}),
          ...(needsLicense ? { licenseKey: generateLicenseKey() } : {}),
        },
      });
    }
    outcome = expiryChanged ? "extended" : "unchanged";
  }

  // Owning a bundle means owning everything inside it.
  for (const item of product.bundleItems) {
    await grantAccess({
      userId: input.userId,
      productId: item.productId,
      source: "BUNDLE",
      bundleId: product.id,
      orderId: input.orderId ?? null,
      expiresAt: enrollment.expiresAt,
      notify: false,
    });
  }

  if (outcome === "created" || outcome === "reactivated") {
    if (input.notify !== false) {
      await notify(input.userId, {
        type: "access",
        title: `You now have access to ${product.title}`,
        body: `Your ${PRODUCT_TYPE_LABELS[product.type].toLowerCase()} is ready in your library.`,
        href: `/learn/${product.slug}`,
      });
    }
    await emitEvent("enrollment.created", {
      enrollmentId: enrollment.id,
      userId: input.userId,
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      source: input.source,
      expiresAt: enrollment.expiresAt?.toISOString() ?? null,
    });
  }

  return { enrollment, outcome };
}

/** Removes access. Revoking a bundle also revokes the items that were only held through it. */
export async function revokeAccess(enrollmentId: string, reason?: string | null) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { product: { select: { id: true, type: true, slug: true, title: true } } },
  });
  if (!enrollment || enrollment.status === "REVOKED") return enrollment;

  const now = new Date();
  const updated = await db.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "REVOKED", revokedAt: now, ...(reason ? { note: reason.slice(0, 300) } : {}) },
  });

  if (enrollment.product.type === "BUNDLE") {
    await db.enrollment.updateMany({
      where: { userId: enrollment.userId, bundleId: enrollment.productId, source: "BUNDLE", status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
  }

  await emitEvent("enrollment.revoked", {
    enrollmentId,
    userId: enrollment.userId,
    productId: enrollment.productId,
    productSlug: enrollment.product.slug,
    productTitle: enrollment.product.title,
    reason: reason ?? null,
  });

  return updated;
}

/** Seats left on a product with a seat limit, or null when it is unlimited. */
export async function seatsRemaining(product: { id: string; seatLimit: number | null }) {
  if (!product.seatLimit) return null;
  const taken = await db.enrollment.count({
    where: {
      productId: product.id,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return Math.max(0, product.seatLimit - taken);
}

/**
 * Emails the student that something was added to their library. Accounts that were created
 * for them (by a purchase elsewhere, an import or an admin) get a one-click link that signs
 * them in and lets them choose a password.
 */
export async function sendAccessEmail(enrollmentId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      user: { select: { id: true, name: true, email: true, passwordHash: true, lastLoginAt: true } },
      product: { select: { title: true, slug: true, type: true } },
    },
  });
  if (!enrollment) return;

  const { general } = await loadSettings();
  const productPath = `/learn/${enrollment.product.slug}`;
  const needsSetup = !enrollment.user.passwordHash && !enrollment.user.lastLoginAt;
  let setupUrl: string | null = null;
  if (needsSetup) {
    const { token } = await issueToken({
      type: "INVITE",
      email: enrollment.user.email,
      userId: enrollment.user.id,
      ttlMinutes: 7 * 24 * 60,
      keepExisting: true,
    });
    setupUrl = absoluteUrl(`/welcome/${token}?next=${encodeURIComponent(productPath)}`);
  }

  await sendEmail(
    enrollment.user.email,
    "access-granted",
    emails.accessGranted({
      name: enrollment.user.name,
      email: enrollment.user.email,
      productTitle: enrollment.product.title,
      productType: enrollment.product.type,
      productUrl: absoluteUrl(productPath),
      setupUrl,
      licenseKey: enrollment.licenseKey,
      expiresText: enrollment.expiresAt
        ? formatDate(enrollment.expiresAt, { style: "long", locale: general.locale, timeZone: general.timezone })
        : null,
    }),
  );
}
