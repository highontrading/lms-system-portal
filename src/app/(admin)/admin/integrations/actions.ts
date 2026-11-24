"use server";

import { z } from "zod";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { randomToken, sha256 } from "@/server/crypto";
import { db } from "@/server/db";

export const createApiKey = staffAction(
  "integrations.manage",
  z.object({ name: z.string().trim().min(2, "Give the key a name so you can recognise it later").max(60) }),
  async ({ name }, ctx) => {
    const active = await db.apiKey.count({ where: { revokedAt: null } });
    if (active >= 25) throw new ActionError("You have 25 active keys. Revoke one you no longer use first.");

    // Only a hash is stored. The key itself is shown once, right now, and can never be read back.
    const key = `ia_live_${randomToken(24)}`;
    const record = await db.apiKey.create({
      data: { name, prefix: key.slice(0, 12), keyHash: sha256(key), createdById: ctx.user.id },
    });
    await audit(ctx.user, "api-key.create", `Created API key “${name}”`, { entityType: "apiKey", entityId: record.id });
    return { id: record.id, name, key };
  },
);

export const revokeApiKey = staffAction(
  "integrations.manage",
  z.object({ id: z.string().min(1) }),
  async ({ id }, ctx) => {
    const record = await db.apiKey.findUnique({ where: { id } });
    if (!record) throw new ActionError("That key no longer exists.");
    if (!record.revokedAt) {
      await db.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
      await audit(ctx.user, "api-key.revoke", `Revoked API key “${record.name}”`, { entityType: "apiKey", entityId: id });
    }
    return { revoked: true as const };
  },
);
