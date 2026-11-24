import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { requestMeta } from "@/server/url";

type Actor = { id: string; email: string } | null;

/** Records who did what in the admin activity log. Never throws — logging must not break the action. */
export async function audit(
  actor: Actor,
  action: string,
  summary: string,
  details: { entityType?: string; entityId?: string; meta?: Prisma.InputJsonValue } = {},
) {
  try {
    const { ip } = await requestMeta();
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        action,
        summary: summary.slice(0, 500),
        entityType: details.entityType,
        entityId: details.entityId,
        meta: details.meta,
        ip,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log entry", error);
  }
}
