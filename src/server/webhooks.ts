import "server-only";
import { after } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { WebhookEvent } from "@/lib/labels";
import { db } from "@/server/db";
import { decryptSecret, hmacSha256, randomToken } from "@/server/crypto";

const MAX_ATTEMPTS = 6;
// Minutes to wait before attempt 2, 3, 4, 5, 6.
const BACKOFF_MINUTES = [1, 5, 30, 120, 720];

/** Outgoing webhooks may only target ordinary web addresses. */
export function webhookUrlProblem(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a full URL starting with https://";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http and https URLs are supported.";
  if (process.env.NODE_ENV === "production") {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const internal =
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith(".internal");
    if (internal) return "That address points at a private network.";
  }
  return null;
}

/**
 * Queues an event for every subscribed endpoint and delivers it once the current response
 * has been sent. Failures are retried with backoff by the scheduled task.
 */
export async function emitEvent(event: WebhookEvent, data: Record<string, unknown>) {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: event } },
      select: { id: true },
    });
    if (endpoints.length === 0) return;

    const payload = {
      id: `evt_${randomToken(12)}`,
      event,
      createdAt: new Date().toISOString(),
      data,
    } as Prisma.InputJsonValue;

    const deliveries = await Promise.all(
      endpoints.map((endpoint) =>
        db.webhookDelivery.create({ data: { endpointId: endpoint.id, event, payload }, select: { id: true } }),
      ),
    );

    const send = async () => {
      await Promise.all(deliveries.map((delivery) => attemptDelivery(delivery.id)));
    };
    try {
      after(send);
    } catch {
      // Outside a request (scripts, scheduled work) there is nothing to defer behind.
      await send();
    }
  } catch (error) {
    console.error(`[webhooks] could not queue "${event}"`, error);
  }
}

export async function attemptDelivery(deliveryId: string) {
  const delivery = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!delivery || delivery.status === "SUCCESS") return null;

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = hmacSha256(decryptSecret(delivery.endpoint.secret), `${timestamp}.${body}`);

  let responseStatus: number | null = null;
  let responseBody = "";
  let ok = false;
  try {
    const response = await fetch(delivery.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "IdeabroAcademy-Webhooks/1.0",
        "X-Academy-Event": delivery.event,
        "X-Academy-Delivery": delivery.id,
        "X-Academy-Timestamp": String(timestamp),
        "X-Academy-Signature": `sha256=${signature}`,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;
    ok = response.ok;
    responseBody = (await response.text().catch(() => "")).slice(0, 500);
  } catch (error) {
    responseBody = error instanceof Error ? error.message.slice(0, 500) : "Request failed";
  }

  const attempts = delivery.attempts + 1;
  const exhausted = attempts >= MAX_ATTEMPTS;
  return db.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts,
      responseStatus,
      responseBody,
      status: ok ? "SUCCESS" : exhausted ? "FAILED" : "PENDING",
      deliveredAt: ok ? new Date() : null,
      nextAttemptAt:
        ok || exhausted ? null : new Date(Date.now() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000),
    },
  });
}

/** Retries deliveries whose backoff has elapsed. Called by the scheduled task endpoint. */
export async function retryDueDeliveries(limit = 25) {
  const due = await db.webhookDelivery.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const delivery of due) await attemptDelivery(delivery.id);
  return due.length;
}
