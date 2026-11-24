"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, isUniqueViolation, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { isRichTextEmpty, sanitizeRichText } from "@/server/sanitize";

// Addresses the application itself uses; a page with one of these slugs could never be reached.
const RESERVED = new Set([
  "admin", "api", "login", "register", "logout", "catalog", "dashboard", "library", "learn", "live", "certificates",
  "notes", "notifications", "orders", "support", "account", "announcements", "checkout", "verify", "files", "welcome",
  "auth", "forgot-password", "reset-password", "verify-email", "demo", "icon.svg", "favicon.ico", "robots.txt", "sitemap.xml",
]);

const pageSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Give the page a title").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Use at least 2 characters")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only"),
  body: z.string().max(200_000),
  seoDescription: z.string().trim().max(200).optional(),
  isPublished: z.boolean(),
  showInFooter: z.boolean(),
});

export const savePage = staffAction("pages.manage", pageSchema, async (input, ctx) => {
  if (RESERVED.has(input.slug)) {
    throw new ActionError("Please check the highlighted fields.", { slug: "That address is used by the app itself. Pick another." });
  }
  const body = sanitizeRichText(input.body);
  if (isRichTextEmpty(body)) throw new ActionError("Please check the highlighted fields.", { body: "Add some content" });

  const data = {
    title: input.title,
    slug: input.slug,
    body,
    seoDescription: input.seoDescription || null,
    isPublished: input.isPublished,
    showInFooter: input.showInFooter,
  };

  try {
    if (input.id) {
      const page = await db.page.update({ where: { id: input.id }, data });
      await audit(ctx.user, "page.update", `Updated page “${page.title}”`, { entityType: "page", entityId: page.id });
      return { id: page.id, created: false };
    }
    const position = await db.page.count();
    const page = await db.page.create({ data: { ...data, position } });
    await audit(ctx.user, "page.create", `Created page “${page.title}”`, { entityType: "page", entityId: page.id });
    return { id: page.id, created: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ActionError("Please check the highlighted fields.", { slug: "Another page already uses this address" });
    }
    throw error;
  }
});

export const deletePage = staffAction(
  "pages.manage",
  z.object({ id: z.string().min(1) }),
  async ({ id }, ctx) => {
    const page = await db.page.findUnique({ where: { id }, select: { title: true } });
    if (page) {
      await db.page.delete({ where: { id } });
      await audit(ctx.user, "page.delete", `Deleted page “${page.title}”`, { entityType: "page", entityId: id });
    }
    redirect("/admin/pages");
  },
  { refresh: false },
);
