import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { dayKey, dayKeyToDate, fromLocalInputValue, shiftDayKey } from "@/lib/dates";
import { db } from "@/server/db";

export type DailyPoint = { day: string; value: number };

const RANGE_DAYS = 30;

/** Everything the admin dashboard shows: headline counts, two 30-day series and two short lists. */
export async function getDashboardData(timeZone: string) {
  const now = new Date();
  const today = dayKey(now, timeZone);
  const firstDay = shiftDayKey(today, -(RANGE_DAYS - 1));
  const rangeStart = fromLocalInputValue(`${firstDay}T00:00`, timeZone) ?? new Date(now.getTime() - RANGE_DAYS * 86_400_000);

  const activeAccess: Prisma.EnrollmentWhereInput = {
    status: "ACTIVE",
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
  const trackable: Prisma.EnrollmentWhereInput = {
    ...activeAccess,
    product: { lessons: { some: { isPublished: true } } },
  };

  const [
    students,
    newStudents,
    activeLearners,
    activeEnrollments,
    trackableEnrollments,
    completedEnrollments,
    certificates,
    grantRows,
    activityRows,
    recentGrants,
    topGroups,
  ] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: rangeStart } } }),
    db.activityDay.findMany({
      where: { day: { gte: dayKeyToDate(shiftDayKey(today, -6)) } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    db.enrollment.count({ where: activeAccess }),
    db.enrollment.count({ where: trackable }),
    db.enrollment.count({ where: { ...trackable, completedAt: { not: null } } }),
    db.certificate.count({ where: { revokedAt: null } }),
    db.enrollment.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true },
      take: 100_000,
    }),
    db.activityDay.groupBy({
      by: ["day"],
      where: { day: { gte: dayKeyToDate(firstDay) } },
      _sum: { lessonsCompleted: true },
    }),
    db.enrollment.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        product: { select: { id: true, title: true, type: true } },
      },
    }),
    db.enrollment.groupBy({
      by: ["productId"],
      where: activeAccess,
      _count: { _all: true },
      _avg: { progressPercent: true },
      orderBy: { _count: { productId: "desc" } },
      take: 5,
    }),
  ]);

  const days = Array.from({ length: RANGE_DAYS }, (_, index) => shiftDayKey(firstDay, index));

  const grantsByDay = new Map<string, number>();
  for (const row of grantRows) {
    const key = dayKey(row.createdAt, timeZone);
    grantsByDay.set(key, (grantsByDay.get(key) ?? 0) + 1);
  }
  const lessonsByDay = new Map<string, number>();
  for (const row of activityRows) {
    lessonsByDay.set(row.day.toISOString().slice(0, 10), row._sum.lessonsCompleted ?? 0);
  }

  const topProducts = topGroups.length
    ? await db.product.findMany({
        where: { id: { in: topGroups.map((group) => group.productId) } },
        select: {
          id: true,
          title: true,
          type: true,
          _count: { select: { lessons: { where: { isPublished: true } } } },
        },
      })
    : [];

  return {
    totals: {
      students,
      newStudents,
      activeLearners: activeLearners.length,
      activeEnrollments,
      completionRate: trackableEnrollments > 0 ? Math.round((completedEnrollments / trackableEnrollments) * 100) : null,
      completedEnrollments,
      certificates,
    },
    grantsSeries: days.map((day): DailyPoint => ({ day, value: grantsByDay.get(day) ?? 0 })),
    lessonsSeries: days.map((day): DailyPoint => ({ day, value: lessonsByDay.get(day) ?? 0 })),
    recentGrants,
    topProducts: topGroups.flatMap((group) => {
      const product = topProducts.find((item) => item.id === group.productId);
      if (!product) return [];
      return [
        {
          id: product.id,
          title: product.title,
          type: product.type,
          students: group._count._all,
          averageProgress: product._count.lessons > 0 ? Math.round(group._avg.progressPercent ?? 0) : null,
        },
      ];
    }),
  };
}
