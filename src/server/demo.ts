import "server-only";
import { db } from "@/server/db";
import { deleteObject } from "@/server/storage";

/** Everything created by the demo seed is tagged so it can be found and removed in one go. */
export const DEMO_SKU_PREFIX = "DEMO-";
export const DEMO_EMAIL_DOMAIN = "@example.com";
export const DEMO_ORDER_REF_PREFIX = "demo-";
export const DEMO_COUPON_NOTE = "Demo coupon";
export const DEMO_ANNOUNCEMENT_TITLES = ["Welcome to the academy 👋", "New bonus module is live"];

export async function hasDemoContent() {
  const count = await db.product.count({ where: { sku: { startsWith: DEMO_SKU_PREFIX } } });
  return count > 0;
}

/**
 * Removes the sample products, sample students and everything attached to them.
 * Real products, real students, settings and pages are left untouched.
 */
export async function removeDemoContent() {
  const products = await db.product.findMany({
    where: { sku: { startsWith: DEMO_SKU_PREFIX } },
    select: { id: true, assets: { select: { fileKey: true } } },
  });
  const productIds = products.map((product) => product.id);
  const fileKeys = products.flatMap((product) => product.assets.map((asset) => asset.fileKey)).filter(Boolean) as string[];

  const demoUsers = await db.user.findMany({
    where: { email: { endsWith: DEMO_EMAIL_DOMAIN }, role: "STUDENT" },
    select: { id: true },
  });
  const userIds = demoUsers.map((user) => user.id);

  await db.$transaction([
    db.order.deleteMany({ where: { externalRef: { startsWith: DEMO_ORDER_REF_PREFIX } } }),
    db.enrollment.deleteMany({ where: { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] } }),
    db.certificate.deleteMany({ where: { OR: [{ productId: { in: productIds } }, { userId: { in: userIds } }] } }),
    db.announcement.deleteMany({ where: { title: { in: DEMO_ANNOUNCEMENT_TITLES } } }),
    db.coupon.deleteMany({ where: { description: { startsWith: DEMO_COUPON_NOTE } } }),
    db.product.deleteMany({ where: { id: { in: productIds } } }),
    db.user.deleteMany({ where: { id: { in: userIds } } }),
    db.media.deleteMany({ where: { key: { in: fileKeys } } }),
  ]);

  for (const key of fileKeys) {
    try {
      await deleteObject(key);
    } catch {
      // The file may already be gone; the database rows are what matter.
    }
  }

  return { products: productIds.length, students: userIds.length };
}
