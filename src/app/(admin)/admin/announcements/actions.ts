"use server";

import { after } from "next/server";
import { z } from "zod";
import { stripHtml, truncate } from "@/lib/utils";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { sendBulkEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { isRichTextEmpty, sanitizeRichText } from "@/server/sanitize";
import { absoluteUrl } from "@/server/url";

/** Students who should see an announcement: everyone, or people with active access to one product. */
async function audienceFor(audience: "ALL" | "PRODUCT", productId: string | null) {
  if (audience === "PRODUCT" && productId) {
    const enrollments = await db.enrollment.findMany({
      where: {
        productId,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        user: { status: "ACTIVE" },
      },
      select: { user: { select: { id: true, email: true, emailAnnouncements: true } } },
    });
    return enrollments.map((enrollment) => enrollment.user);
  }
  return db.user.findMany({
    where: { role: "STUDENT", status: "ACTIVE" },
    select: { id: true, email: true, emailAnnouncements: true },
  });
}

export const saveAnnouncement = staffAction(
  "announcements.manage",
  z.object({
    id: z.string().optional(),
    title: z.string().trim().min(3, "Give the announcement a title").max(140),
    body: z.string().max(60_000),
    audience: z.enum(["ALL", "PRODUCT"]),
    productId: z.string().nullable().optional(),
    isPinned: z.boolean(),
    published: z.boolean(),
    sendEmail: z.boolean(),
  }),
  async (input, ctx) => {
    const body = sanitizeRichText(input.body);
    if (isRichTextEmpty(body)) throw new ActionError("Please check the highlighted fields.", { body: "Write the announcement" });

    let productId: string | null = null;
    if (input.audience === "PRODUCT") {
      const product = input.productId ? await db.product.findUnique({ where: { id: input.productId }, select: { id: true } }) : null;
      if (!product) throw new ActionError("Please check the highlighted fields.", { productId: "Choose a product" });
      productId = product.id;
    }

    const existing = input.id ? await db.announcement.findUnique({ where: { id: input.id } }) : null;
    if (input.id && !existing) throw new ActionError("That announcement no longer exists.");

    const publishingNow = input.published && !existing?.publishedAt;
    const data = {
      title: input.title,
      body,
      audience: input.audience,
      productId,
      isPinned: input.isPinned,
      publishedAt: input.published ? (existing?.publishedAt ?? new Date()) : null,
    };

    const announcement = existing
      ? await db.announcement.update({ where: { id: existing.id }, data })
      : await db.announcement.create({ data: { ...data, createdById: ctx.user.id } });

    let notified = 0;
    let emailing = 0;
    if (publishingNow) {
      const recipients = await audienceFor(input.audience, productId);
      notified = recipients.length;
      await notify(
        recipients.map((user) => user.id),
        { type: "announcement", title: input.title, body: truncate(stripHtml(body), 180), href: "/announcements" },
      );

      if (input.sendEmail && !announcement.emailedAt) {
        const addresses = recipients.filter((user) => user.emailAnnouncements).map((user) => user.email);
        emailing = addresses.length;
        if (addresses.length > 0) {
          await db.announcement.update({ where: { id: announcement.id }, data: { emailedAt: new Date() } });
          const content = emails.announcement({ title: input.title, bodyHtml: body, url: absoluteUrl("/announcements") });
          // Sending to a whole audience can take a while; don't keep the admin waiting on it.
          after(async () => {
            await sendBulkEmail(addresses, "announcement", content);
          });
        }
      }
    }

    await audit(
      ctx.user,
      existing ? "announcement.update" : "announcement.create",
      `${publishingNow ? "Published" : existing ? "Updated" : "Drafted"} announcement “${input.title}”`,
      { entityType: "announcement", entityId: announcement.id },
    );

    return { id: announcement.id, publishedNow: publishingNow, notified, emailing };
  },
);

export const deleteAnnouncement = staffAction(
  "announcements.manage",
  z.object({ id: z.string().min(1) }),
  async ({ id }, ctx) => {
    const announcement = await db.announcement.findUnique({ where: { id }, select: { title: true } });
    if (!announcement) return { deleted: true as const };
    await db.announcement.delete({ where: { id } });
    await audit(ctx.user, "announcement.delete", `Deleted announcement “${announcement.title}”`, {
      entityType: "announcement",
      entityId: id,
    });
    return { deleted: true as const };
  },
);
