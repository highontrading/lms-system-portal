import "server-only";
import type { Coupon } from "@/generated/prisma/client";
import type { CouponType } from "@/generated/prisma/enums";
import { db } from "@/server/db";

/** Amount taken off a subtotal (minor units). Never more than the subtotal. */
export function couponDiscount(coupon: { type: CouponType; value: number }, subtotal: number) {
  if (subtotal <= 0) return 0;
  const raw = coupon.type === "PERCENT" ? Math.round((subtotal * Math.min(100, coupon.value)) / 100) : coupon.value;
  return Math.max(0, Math.min(subtotal, raw));
}

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export type CouponEvaluation =
  | { ok: true; coupon: Coupon; discount: number }
  | { ok: false; error: string };

/** Checks every rule on a coupon for a given product and buyer. */
export async function evaluateCoupon(
  codeInput: string,
  product: { id: string; price: number },
  userId: string | null,
): Promise<CouponEvaluation> {
  const code = normalizeCouponCode(codeInput);
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await db.coupon.findUnique({
    where: { code },
    include: { products: { select: { id: true } } },
  });
  const now = new Date();

  if (!coupon || !coupon.isActive) return { ok: false, error: "That coupon code isn't valid." };
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "That coupon isn't active yet." };
  if (coupon.expiresAt && coupon.expiresAt < now) return { ok: false, error: "That coupon has expired." };
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    return { ok: false, error: "That coupon has been fully redeemed." };
  }
  if (coupon.products.length > 0 && !coupon.products.some((item) => item.id === product.id)) {
    return { ok: false, error: "That coupon doesn't apply to this product." };
  }
  if (coupon.minAmount !== null && product.price < coupon.minAmount) {
    return { ok: false, error: "This order doesn't meet the coupon's minimum amount." };
  }
  if (userId && coupon.perUserLimit > 0) {
    const used = await db.order.count({ where: { userId, couponId: coupon.id, status: "PAID" } });
    if (used >= coupon.perUserLimit) return { ok: false, error: "You've already used this coupon." };
  }

  const discount = couponDiscount(coupon, product.price);
  if (discount <= 0) return { ok: false, error: "That coupon doesn't reduce the price of this product." };
  return { ok: true, coupon, discount };
}
