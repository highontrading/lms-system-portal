import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ProductType } from "@/generated/prisma/enums";
import { db } from "@/server/db";

const cardSelect = {
  id: true,
  slug: true,
  type: true,
  title: true,
  tagline: true,
  thumbnailUrl: true,
  price: true,
  compareAtPrice: true,
  durationLabel: true,
  liveSessions: {
    where: { startsAt: { gt: new Date(0) }, status: { in: ["SCHEDULED", "LIVE"] } },
    orderBy: { startsAt: "asc" },
    select: { startsAt: true, durationMinutes: true },
  },
} satisfies Prisma.ProductSelect;

type Row = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

function toCard(row: Row) {
  const now = Date.now();
  const next = row.liveSessions.find((session) => session.startsAt.getTime() + session.durationMinutes * 60_000 > now);
  const { liveSessions: _sessions, ...rest } = row;
  void _sessions;
  return { ...rest, nextSessionAt: next?.startsAt ?? null };
}

/** Products listed publicly: published and visible in the catalog. */
export async function listCatalog(options: { type?: ProductType | null; query?: string | null; featuredOnly?: boolean; take?: number } = {}) {
  const query = options.query?.trim();
  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      visibility: "PUBLIC",
      ...(options.type ? { type: options.type } : {}),
      ...(options.featuredOnly ? { featured: true } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { tagline: { contains: query, mode: "insensitive" } },
              { tags: { has: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ featured: "desc" }, { position: "asc" }, { publishedAt: "desc" }],
    take: options.take,
    select: cardSelect,
  });
  return rows.map(toCard);
}

/** Product ids the user currently has access to. */
export async function ownedProductIds(userId: string | null | undefined) {
  if (!userId) return new Set<string>();
  const rows = await db.enrollment.findMany({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    select: { productId: true },
  });
  return new Set(rows.map((row) => row.productId));
}
