"use server";

import { z } from "zod";
import { slugify } from "@/lib/utils";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "category";
  let slug = base;
  for (let n = 2; n < 100; n++) {
    const taken = await db.category.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export const saveCategory = staffAction(
  "products.manage",
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Give it a name").max(60),
    description: z.string().trim().max(300),
    position: z.number().int().min(0).max(10_000),
  }),
  async (input, ctx) => {
    if (input.id) {
      const existing = await db.category.findUnique({ where: { id: input.id } });
      if (!existing) throw new ActionError("That category no longer exists.");
      await db.category.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description || null,
          position: input.position,
          // Keep the address stable unless the name actually changed.
          ...(existing.name !== input.name ? { slug: await uniqueSlug(input.name, input.id) } : {}),
        },
      });
      await audit(ctx.user, "category.update", `Updated category “${input.name}”`, { entityType: "category", entityId: input.id });
      return;
    }
    const category = await db.category.create({
      data: { name: input.name, slug: await uniqueSlug(input.name), description: input.description || null, position: input.position },
    });
    await audit(ctx.user, "category.create", `Created category “${input.name}”`, { entityType: "category", entityId: category.id });
  },
);

export const deleteCategory = staffAction("products.manage", z.object({ id: z.string() }), async ({ id }, ctx) => {
  const category = await db.category.findUnique({ where: { id }, select: { name: true } });
  if (!category) return;
  // Products in this category simply become uncategorised.
  await db.category.delete({ where: { id } });
  await audit(ctx.user, "category.delete", `Deleted category “${category.name}”`, { entityType: "category", entityId: id });
});
