import "server-only";
import type { ProductType } from "@/generated/prisma/enums";
import { HOUR_MS } from "@/lib/dates";
import { isEnrollmentActive } from "@/server/access";
import { db } from "@/server/db";

export type OwnedProduct = {
  enrollmentId: string;
  productId: string;
  slug: string;
  title: string;
  tagline: string | null;
  type: ProductType;
  thumbnailUrl: string | null;
  version: string | null;
  progressPercent: number;
  completedAt: Date | null;
  expiresAt: Date | null;
  revoked: boolean;
  lastLessonId: string | null;
  lastAccessedAt: Date | null;
  enrolledAt: Date;
  totalLessons: number;
  completedLessons: number;
  nextSessionAt: Date | null;
};

/**
 * Everything the student has (or had) access to, most recently used first.
 * `active` is what they can open now; `lapsed` has expired or been removed.
 */
export async function getLibrary(userId: string) {
  const now = new Date();
  const [enrollments, completed] = await Promise.all([
    db.enrollment.findMany({
      // Products still being drafted stay hidden even if access was granted early.
      where: { userId, product: { status: { not: "DRAFT" } } },
      orderBy: [{ lastAccessedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            title: true,
            tagline: true,
            type: true,
            thumbnailUrl: true,
            version: true,
            _count: { select: { lessons: { where: { isPublished: true } } } },
            liveSessions: {
              where: { status: { in: ["SCHEDULED", "LIVE"] }, startsAt: { gte: new Date(now.getTime() - 3 * HOUR_MS) } },
              orderBy: { startsAt: "asc" },
              take: 1,
              select: { startsAt: true },
            },
          },
        },
      },
    }),
    db.lessonProgress.findMany({
      where: { userId, completedAt: { not: null }, lesson: { isPublished: true } },
      select: { productId: true },
    }),
  ]);

  const completedByProduct = new Map<string, number>();
  for (const row of completed) completedByProduct.set(row.productId, (completedByProduct.get(row.productId) ?? 0) + 1);

  const active: OwnedProduct[] = [];
  const lapsed: OwnedProduct[] = [];
  for (const enrollment of enrollments) {
    const { product } = enrollment;
    const item: OwnedProduct = {
      enrollmentId: enrollment.id,
      productId: product.id,
      slug: product.slug,
      title: product.title,
      tagline: product.tagline,
      type: product.type,
      thumbnailUrl: product.thumbnailUrl,
      version: product.version,
      progressPercent: enrollment.progressPercent,
      completedAt: enrollment.completedAt,
      expiresAt: enrollment.expiresAt,
      revoked: enrollment.status === "REVOKED",
      lastLessonId: enrollment.lastLessonId,
      lastAccessedAt: enrollment.lastAccessedAt,
      enrolledAt: enrollment.createdAt,
      totalLessons: product._count.lessons,
      completedLessons: Math.min(product._count.lessons, completedByProduct.get(product.id) ?? 0),
      nextSessionAt: product.liveSessions[0]?.startsAt ?? null,
    };
    (isEnrollmentActive(enrollment, now) ? active : lapsed).push(item);
  }

  return { active, lapsed, lessonsCompleted: completed.length };
}

/** Published announcements this student should see: site-wide ones and those for products they own. */
export function visibleAnnouncementsWhere(ownedProductIds: string[]) {
  return {
    publishedAt: { not: null, lte: new Date() },
    OR: [{ audience: "ALL" as const }, { audience: "PRODUCT" as const, productId: { in: ownedProductIds } }],
  };
}

export async function getDashboardExtras(userId: string, ownedProductIds: string[], everEnrolledProductIds: string[]) {
  const now = new Date();
  const [sessions, announcements, recommended, certificates, openedLesson] = await Promise.all([
    db.liveSession.findMany({
      where: {
        productId: { in: ownedProductIds },
        status: { in: ["SCHEDULED", "LIVE"] },
        startsAt: { gte: new Date(now.getTime() - 3 * HOUR_MS) },
      },
      orderBy: { startsAt: "asc" },
      take: 2,
      select: {
        id: true,
        title: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        product: { select: { slug: true, title: true } },
      },
    }),
    db.announcement.findMany({
      where: visibleAnnouncementsWhere(ownedProductIds),
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      take: 3,
      select: {
        id: true,
        title: true,
        body: true,
        isPinned: true,
        publishedAt: true,
        product: { select: { title: true } },
      },
    }),
    db.product.findMany({
      where: { status: "PUBLISHED", visibility: "PUBLIC", id: { notIn: everEnrolledProductIds } },
      orderBy: [{ featured: "desc" }, { position: "asc" }, { publishedAt: "desc" }],
      take: 3,
      select: { id: true, slug: true, title: true, tagline: true, type: true, thumbnailUrl: true },
    }),
    db.certificate.count({ where: { userId, revokedAt: null } }),
    db.lessonProgress.count({ where: { userId } }),
  ]);

  return { sessions, announcements, recommended, certificates, hasOpenedLesson: openedLesson > 0 };
}
