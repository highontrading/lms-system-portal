"use server";

import { z } from "zod";
import { safeHref, slugify } from "@/lib/utils";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "instructor";
  let slug = base;
  for (let n = 2; n < 100; n++) {
    const taken = await db.instructor.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

const link = z.string().trim().max(300);

export const saveInstructor = staffAction(
  "products.manage",
  z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Enter a name").max(80),
    title: z.string().trim().max(120),
    bio: z.string().trim().max(2000),
    avatarUrl: link,
    website: link,
    twitter: link,
    linkedin: link,
    youtube: link,
    instagram: link,
  }),
  async (input, ctx) => {
    const fieldErrors: Record<string, string> = {};
    for (const key of ["avatarUrl", "website", "twitter", "linkedin", "youtube", "instagram"] as const) {
      if (input[key] && !safeHref(input[key])) fieldErrors[key] = "Enter a full link starting with https://";
    }
    if (Object.keys(fieldErrors).length > 0) throw new ActionError("Please check the highlighted fields.", fieldErrors);

    const data = {
      name: input.name,
      title: input.title || null,
      bio: input.bio || null,
      avatarUrl: input.avatarUrl || null,
      website: input.website || null,
      twitter: input.twitter || null,
      linkedin: input.linkedin || null,
      youtube: input.youtube || null,
      instagram: input.instagram || null,
    };

    if (input.id) {
      const existing = await db.instructor.findUnique({ where: { id: input.id } });
      if (!existing) throw new ActionError("That instructor no longer exists.");
      await db.instructor.update({
        where: { id: input.id },
        data: { ...data, ...(existing.name !== input.name ? { slug: await uniqueSlug(input.name, input.id) } : {}) },
      });
      await audit(ctx.user, "instructor.update", `Updated instructor “${input.name}”`, { entityType: "instructor", entityId: input.id });
      return;
    }
    const instructor = await db.instructor.create({ data: { ...data, slug: await uniqueSlug(input.name) } });
    await audit(ctx.user, "instructor.create", `Added instructor “${input.name}”`, { entityType: "instructor", entityId: instructor.id });
  },
);

export const deleteInstructor = staffAction("products.manage", z.object({ id: z.string() }), async ({ id }, ctx) => {
  const instructor = await db.instructor.findUnique({ where: { id }, select: { name: true } });
  if (!instructor) return;
  await db.instructor.delete({ where: { id } });
  await audit(ctx.user, "instructor.delete", `Removed instructor “${instructor.name}”`, { entityType: "instructor", entityId: id });
});
