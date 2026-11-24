import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, PaymentGateway, ProductType } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/utils";
import { grantAccess, revokeAccess, sendAccessEmail } from "@/server/access";
import { randomToken } from "@/server/crypto";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { loadSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";
import { emitEvent } from "@/server/webhooks";

export function formatOrderNumber(prefix: string, seq: number) {
  return `${prefix}${String(seq).padStart(6, "0")}`;
}

export type OrderItemInput = { productId: string; title: string; type: ProductType; price: number };

export type CreateOrderInput = {
  userId: string | null;
  email: string;
  name?: string | null;
  currency: string;
  items: OrderItemInput[];
  discount?: number;
  couponId?: string | null;
  couponCode?: string | null;
  gateway: PaymentGateway;
  status?: OrderStatus;
  externalRef?: string | null;
  note?: string | null;
  meta?: Prisma.InputJsonValue;
  billingName?: string | null;
  billingPhone?: string | null;
  paidAt?: Date | null;
  gatewayPaymentId?: string | null;
};

/** Creates an order with a sequential, human-readable number (e.g. IA-000042). */
export async function createOrder(input: CreateOrderInput) {
  const { invoice } = await loadSettings();
  const subtotal = input.items.reduce((sum, item) => sum + item.price, 0);
  const discount = Math.min(subtotal, Math.max(0, input.discount ?? 0));

  return db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        // Placeholder until the sequence value is known.
        number: `pending-${randomToken(9)}`,
        userId: input.userId,
        email: input.email.toLowerCase(),
        name: input.name ?? null,
        status: input.status ?? "PENDING",
        currency: input.currency,
        subtotal,
        discount,
        total: subtotal - discount,
        couponId: input.couponId ?? null,
        couponCode: input.couponCode ?? null,
        gateway: input.gateway,
        externalRef: input.externalRef ?? null,
        note: input.note ?? null,
        meta: input.meta,
        billingName: input.billingName ?? input.name ?? null,
        billingPhone: input.billingPhone ?? null,
        paidAt: input.paidAt ?? null,
        gatewayPaymentId: input.gatewayPaymentId ?? null,
        items: { create: input.items },
      },
    });
    return tx.order.update({
      where: { id: created.id },
      data: { number: formatOrderNumber(invoice.orderPrefix, created.seq) },
      include: { items: true },
    });
  });
}

/**
 * Marks an order as paid and delivers what was bought. Idempotent: the payment callback and
 * the gateway webhook can both call it and access is granted exactly once.
 */
export async function fulfillOrder(orderId: string, payment: { gatewayPaymentId?: string | null } = {}) {
  const flipped = await db.order.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      ...(payment.gatewayPaymentId ? { gatewayPaymentId: payment.gatewayPaymentId } : {}),
    },
  });

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) return null;
  if (flipped.count === 0) return { order, fulfilledNow: false };

  if (order.couponId) {
    await db.coupon.update({ where: { id: order.couponId }, data: { redeemedCount: { increment: 1 } } });
  }

  if (order.userId) {
    for (const item of order.items) {
      if (!item.productId) continue;
      const { enrollment, outcome } = await grantAccess({
        userId: order.userId,
        productId: item.productId,
        source: order.total === 0 ? "FREE" : "PURCHASE",
        orderId: order.id,
      });
      if (outcome === "created" || outcome === "reactivated") await sendAccessEmail(enrollment.id);
    }
  }

  const { general } = await loadSettings();
  if (order.total > 0) {
    await sendEmail(
      order.email,
      "order-receipt",
      emails.orderReceipt({
        name: order.name ?? order.user?.name ?? "there",
        orderNumber: order.number,
        items: order.items.map((item) => item.title),
        total: formatMoney(order.total, order.currency, general.locale),
        url: absoluteUrl(`/orders/${order.number}`),
      }),
    );
    if (order.userId) {
      await notify(order.userId, {
        type: "order",
        title: `Payment received for order ${order.number}`,
        href: `/orders/${order.number}`,
      });
    }
  }

  await emitEvent("order.paid", {
    orderId: order.id,
    number: order.number,
    userId: order.userId,
    email: order.email,
    total: order.total,
    currency: order.currency,
    gateway: order.gateway,
    items: order.items.map((item) => ({ productId: item.productId, title: item.title, price: item.price })),
  });

  return { order, fulfilledNow: true };
}

export async function markOrderFailed(orderId: string) {
  await db.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "FAILED" } });
}

/** Records a refund and, by default, removes the access the order gave. The money itself is refunded in the gateway. */
export async function refundOrder(orderId: string, options: { revoke: boolean; note?: string | null }) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { enrollments: true } });
  if (!order || order.status !== "PAID") return null;

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: "REFUNDED",
      refundedAt: new Date(),
      ...(options.note ? { note: [order.note, `Refund: ${options.note}`].filter(Boolean).join("\n") } : {}),
    },
  });

  if (options.revoke) {
    for (const enrollment of order.enrollments) await revokeAccess(enrollment.id, `Order ${order.number} refunded`);
  }
  if (order.couponId) {
    await db.coupon.updateMany({
      where: { id: order.couponId, redeemedCount: { gt: 0 } },
      data: { redeemedCount: { decrement: 1 } },
    });
  }

  await emitEvent("order.refunded", {
    orderId: order.id,
    number: order.number,
    userId: order.userId,
    email: order.email,
    total: order.total,
    currency: order.currency,
    accessRevoked: options.revoke,
  });

  return updated;
}
