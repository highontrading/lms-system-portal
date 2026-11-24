"use server";

import { z } from "zod";
import { ActionError, staffAction } from "@/server/action";
import { grantToEmail, parseExpiryChoice } from "@/server/admin/people";
import { audit } from "@/server/audit";
import { db } from "@/server/db";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const grantAccessByEmail = staffAction(
  "enrollments.manage",
  z.object({
    email: emailField,
    name: z.string().trim().max(80).optional(),
    productId: z.string().min(1, "Choose a product"),
    expiry: z
      .string()
      .regex(/^(lifetime|\d{4}-\d{2}-\d{2})?$/, "Pick a date")
      .optional(),
    sendEmail: z.boolean().default(true),
  }),
  async ({ email, name, productId, expiry, sendEmail }, ctx) => {
    const product = await db.product.findUnique({ where: { id: productId }, select: { title: true } });
    if (!product) throw new ActionError("That product no longer exists.", { productId: "Choose a product" });

    const { user, created, enrollment, outcome } = await grantToEmail({
      email,
      name,
      productId,
      expiresAt: await parseExpiryChoice(expiry),
      source: "MANUAL",
      sendEmail,
    });

    await audit(ctx.user, "access.grant", `Granted ${product.title} to ${user.email}${created ? " (new account)" : ""}`, {
      entityType: "enrollment",
      entityId: enrollment.id,
    });
    return { outcome, created, userId: user.id };
  },
);

const importRow = z.object({
  line: z.number().int(),
  email: z.string().max(320),
  name: z.string().max(120).optional(),
  product: z.string().max(200),
  expiry: z.string().max(20).optional(),
});

export type ImportRowResult = {
  line: number;
  email: string;
  status: "granted" | "existing" | "error";
  newAccount?: boolean;
  message?: string;
};

/**
 * Imports one batch of CSV rows. The browser sends the file in batches so large imports show
 * progress and never run into request time limits.
 */
export const importAccessBatch = staffAction(
  "enrollments.manage",
  z.object({
    rows: z.array(importRow).min(1).max(100),
    sendEmails: z.boolean().default(false),
  }),
  async ({ rows, sendEmails }, ctx) => {
    const products = await db.product.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, slug: true, sku: true, title: true },
    });
    const lookup = new Map<string, { id: string; title: string }>();
    for (const product of products) {
      lookup.set(product.id.toLowerCase(), product);
      lookup.set(product.slug.toLowerCase(), product);
      if (product.sku) lookup.set(product.sku.toLowerCase(), product);
    }

    const results: ImportRowResult[] = [];
    for (const row of rows) {
      const email = row.email.trim().toLowerCase();
      const parsedEmail = emailField.safeParse(email);
      const product = lookup.get(row.product.trim().toLowerCase());
      const expiry = row.expiry?.trim() ?? "";

      if (!parsedEmail.success) {
        results.push({ line: row.line, email, status: "error", message: "Invalid email address" });
        continue;
      }
      if (!product) {
        results.push({ line: row.line, email, status: "error", message: `Unknown product "${row.product.trim()}"` });
        continue;
      }
      if (expiry && !/^(lifetime|\d{4}-\d{2}-\d{2})$/.test(expiry)) {
        results.push({ line: row.line, email, status: "error", message: "Expiry must be YYYY-MM-DD or lifetime" });
        continue;
      }

      try {
        const { created, outcome } = await grantToEmail({
          email: parsedEmail.data,
          name: row.name?.trim() || null,
          productId: product.id,
          expiresAt: await parseExpiryChoice(expiry),
          source: "IMPORT",
          sendEmail: sendEmails,
        });
        results.push({
          line: row.line,
          email,
          status: outcome === "unchanged" ? "existing" : "granted",
          newAccount: created,
        });
      } catch (error) {
        console.error("[import] row failed", error);
        results.push({ line: row.line, email, status: "error", message: "Could not grant access" });
      }
    }

    const granted = results.filter((result) => result.status === "granted").length;
    if (granted > 0) {
      await audit(ctx.user, "access.import", `Imported access for ${granted} row${granted === 1 ? "" : "s"} from CSV`, {
        meta: {
          granted,
          existing: results.filter((result) => result.status === "existing").length,
          errors: results.filter((result) => result.status === "error").length,
        },
      });
    }
    return { results };
  },
  { refresh: false },
);
