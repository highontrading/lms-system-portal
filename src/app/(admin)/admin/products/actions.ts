"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { Level, ProductStatus, ProductType, ProductVisibility } from "@/generated/prisma/enums";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { safeHref, slugify } from "@/lib/utils";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { sanitizeRichText } from "@/server/sanitize";

const id = z.string().min(1);
const line = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max);

async function uniqueSlug(title: string) {
  const base = slugify(title) || "product";
  let slug = base;
  for (let n = 2; n < 200; n++) {
    const taken = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function requireProduct(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, type: true, status: true, slug: true, publishedAt: true },
  });
  if (!product) throw new ActionError("That product no longer exists.");
  return product;
}

export const createProduct = staffAction(
  "products.manage",
  z.object({ type: z.enum(ProductType), title: z.string().trim().min(2, "Give it a title").max(140) }),
  async ({ type, title }, ctx) => {
    const product = await db.product.create({ data: { type, title, slug: await uniqueSlug(title) } });
    await audit(ctx.user, "product.create", `Created ${PRODUCT_TYPE_LABELS[type].toLowerCase()} “${title}”`, {
      entityType: "product",
      entityId: product.id,
    });
    redirect(`/admin/products/${product.id}`);
  },
  { refresh: false },
);

export const updateProductDetails = staffAction(
  "products.manage",
  z.object({
    id,
    title: z.string().trim().min(2, "Give it a title").max(140),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Too short")
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    tagline: optionalText(200),
    description: z.string().max(200_000),
    thumbnailUrl: optionalText(500),
    categoryId: z.string().nullable(),
    instructorIds: z.array(z.string()).max(30),
    level: z.enum(Level),
    language: optionalText(40),
    durationLabel: optionalText(60),
    tags: z.array(line(40)).max(20),
    outcomes: z.array(line(240)).max(30),
    requirements: z.array(line(240)).max(30),
    audience: z.array(line(240)).max(30),
    faqs: z.array(z.object({ q: line(200), a: line(2000) })).max(30),
    version: optionalText(30),
    platform: optionalText(80),
  }),
  async (input, ctx) => {
    const product = await requireProduct(input.id);

    const clash = await db.product.findFirst({ where: { slug: input.slug, id: { not: input.id } }, select: { id: true } });
    if (clash) {
      throw new ActionError("Please check the highlighted fields.", { slug: "Another product already uses this address" });
    }
    if (input.thumbnailUrl && !safeHref(input.thumbnailUrl)) {
      throw new ActionError("Please check the highlighted fields.", { thumbnailUrl: "That image link isn't valid" });
    }

    const [category, instructors] = await Promise.all([
      input.categoryId ? db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }) : null,
      db.instructor.findMany({ where: { id: { in: input.instructorIds } }, select: { id: true } }),
    ]);

    await db.product.update({
      where: { id: input.id },
      data: {
        title: input.title,
        slug: input.slug,
        tagline: input.tagline || null,
        description: sanitizeRichText(input.description) || null,
        thumbnailUrl: input.thumbnailUrl || null,
        categoryId: category?.id ?? null,
        instructors: { set: instructors.map((instructor) => ({ id: instructor.id })) },
        level: input.level,
        language: input.language || "English",
        durationLabel: input.durationLabel || null,
        tags: input.tags,
        outcomes: input.outcomes,
        requirements: input.requirements,
        audience: input.audience,
        faqs: input.faqs as Prisma.InputJsonValue,
        version: input.version || null,
        platform: input.platform || null,
      },
    });
    await audit(ctx.user, "product.update", `Updated details of “${product.title}”`, {
      entityType: "product",
      entityId: product.id,
    });
  },
);

export const updateProductAccess = staffAction(
  "products.manage",
  z.object({
    id,
    checkoutUrl: optionalText(500),
    price: z.number().int().min(0).max(100_000_000_000),
    sku: optionalText(80),
    accessDays: z.number().int().min(1, "At least 1 day").max(36_500).nullable(),
    seatLimit: z.number().int().min(1, "At least 1 seat").max(1_000_000).nullable(),
    sequential: z.boolean(),
    certificateEnabled: z.boolean(),
    completionPercent: z.number().int().min(1).max(100),
    licenseKeysEnabled: z.boolean(),
    bundleProductIds: z.array(z.string()).max(60),
  }),
  async (input, ctx) => {
    const product = await requireProduct(input.id);

    if (input.checkoutUrl && !/^https?:\/\//i.test(input.checkoutUrl)) {
      throw new ActionError("Please check the highlighted fields.", {
        checkoutUrl: "Enter a full link starting with https://",
      });
    }
    if (input.checkoutUrl && input.price === 0) {
      // On the public page a product without a price can be joined for free, which contradicts selling it.
      throw new ActionError("Please check the highlighted fields.", {
        price: "Enter the price people pay. Without a price this product is free to join here.",
      });
    }
    if (input.sku) {
      const clash = await db.product.findFirst({ where: { sku: input.sku, id: { not: input.id } }, select: { title: true } });
      if (clash) {
        throw new ActionError("Please check the highlighted fields.", { sku: `Already used by “${clash.title}”` });
      }
    }

    await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: input.id },
        data: {
          checkoutUrl: input.checkoutUrl || null,
          price: input.price,
          sku: input.sku || null,
          accessDays: input.accessDays,
          seatLimit: input.seatLimit,
          sequential: input.sequential,
          certificateEnabled: input.certificateEnabled,
          completionPercent: input.completionPercent,
          licenseKeysEnabled: input.licenseKeysEnabled,
        },
      });

      if (product.type === "BUNDLE") {
        // A bundle can contain any product except itself and other bundles.
        const allowed = await tx.product.findMany({
          where: { id: { in: input.bundleProductIds, not: input.id }, type: { not: "BUNDLE" } },
          select: { id: true },
        });
        const allowedIds = new Set(allowed.map((item) => item.id));
        const ordered = input.bundleProductIds.filter((productId, index, all) => allowedIds.has(productId) && all.indexOf(productId) === index);
        await tx.bundleItem.deleteMany({ where: { bundleId: input.id } });
        if (ordered.length > 0) {
          await tx.bundleItem.createMany({
            data: ordered.map((productId, position) => ({ bundleId: input.id, productId, position })),
          });
        }
      }
    });

    await audit(ctx.user, "product.access", `Updated access rules of “${product.title}”`, {
      entityType: "product",
      entityId: product.id,
    });
  },
);

export const updateProductSettings = staffAction(
  "products.manage",
  z.object({
    id,
    visibility: z.enum(ProductVisibility),
    featured: z.boolean(),
    position: z.number().int().min(0).max(100_000),
    seoTitle: optionalText(70),
    seoDescription: optionalText(200),
  }),
  async (input, ctx) => {
    const product = await requireProduct(input.id);
    await db.product.update({
      where: { id: input.id },
      data: {
        visibility: input.visibility,
        featured: input.featured,
        position: input.position,
        seoTitle: input.seoTitle || null,
        seoDescription: input.seoDescription || null,
      },
    });
    await audit(ctx.user, "product.settings", `Updated settings of “${product.title}”`, {
      entityType: "product",
      entityId: product.id,
    });
  },
);

export const setProductStatus = staffAction(
  "products.manage",
  z.object({ id, status: z.enum(ProductStatus) }),
  async ({ id: productId, status }, ctx) => {
    const product = await requireProduct(productId);
    await db.product.update({
      where: { id: productId },
      data: { status, ...(status === "PUBLISHED" && !product.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    const verb = status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Moved to draft";
    await audit(ctx.user, "product.status", `${verb} “${product.title}”`, { entityType: "product", entityId: productId });
    return { status };
  },
);

export const deleteProduct = staffAction(
  "products.manage",
  z.object({ id }),
  async ({ id: productId }, ctx) => {
    const product = await requireProduct(productId);
    const enrolments = await db.enrollment.count({ where: { productId } });
    if (enrolments > 0) {
      throw new ActionError(
        `${enrolments.toLocaleString("en")} ${enrolments === 1 ? "student has" : "students have"} been given this product, so it can't be deleted. Archive it instead — students keep their access and it disappears from the catalog.`,
      );
    }
    await db.product.delete({ where: { id: productId } });
    await audit(ctx.user, "product.delete", `Deleted “${product.title}”`, { entityType: "product", entityId: productId });
    redirect("/admin/products");
  },
  { refresh: false },
);
