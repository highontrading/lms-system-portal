import "server-only";
import { progressPercent } from "@/lib/curriculum";
import { computeStreak, dayKey, dayKeyToDate, shiftDayKey } from "@/lib/dates";
import { issueCertificate } from "@/server/certificates";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { loadSettings } from "@/server/settings";
import { emitEvent } from "@/server/webhooks";

/**
 * Recomputes a student's progress on a product from their completed lessons and stores it on
 * the enrolment. The first time the completion threshold is reached, the product is marked
 * complete and a certificate is issued when the product offers one. Completion is never taken
 * away again — adding lessons later or resetting progress keeps earned certificates.
 */
export async function recalculateProgress(userId: string, productId: string) {
  const [product, total, completed, enrollment] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, slug: true, completionPercent: true, certificateEnabled: true },
    }),
    db.lesson.count({ where: { productId, isPublished: true } }),
    db.lessonProgress.count({
      where: { userId, productId, completedAt: { not: null }, lesson: { isPublished: true } },
    }),
    db.enrollment.findUnique({ where: { userId_productId: { userId, productId } } }),
  ]);
  if (!product || !enrollment) return null;

  const percent = progressPercent(completed, total);
  const newlyCompleted = total > 0 && percent >= product.completionPercent && !enrollment.completedAt;

  await db.enrollment.update({
    where: { id: enrollment.id },
    data: { progressPercent: percent, ...(newlyCompleted ? { completedAt: new Date() } : {}) },
  });

  let certificateSerial: string | null = null;
  if (newlyCompleted) {
    if (product.certificateEnabled) {
      certificateSerial = (await issueCertificate(userId, productId))?.serial ?? null;
    } else {
      await notify(userId, {
        type: "system",
        title: `You completed ${product.title} 🎉`,
        href: `/learn/${product.slug}`,
      });
    }
    await emitEvent("product.completed", {
      userId,
      productId,
      productSlug: product.slug,
      productTitle: product.title,
      completedAt: new Date().toISOString(),
    });
  }

  return { percent, completed, total, newlyCompleted, certificateSerial };
}

/** Records that the student learned today (for streaks and the activity chart). */
export async function recordActivity(userId: string, lessonsCompleted = 0) {
  const { general } = await loadSettings();
  const day = dayKeyToDate(dayKey(new Date(), general.timezone));
  await db.activityDay.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, lessonsCompleted },
    update: lessonsCompleted ? { lessonsCompleted: { increment: lessonsCompleted } } : {},
  });
}

export async function setLessonCompletion(
  userId: string,
  lesson: { id: string; productId: string },
  completed: boolean,
) {
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    select: { completedAt: true },
  });
  const wasCompleted = !!existing?.completedAt;

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId: lesson.id } },
    create: { userId, lessonId: lesson.id, productId: lesson.productId, completedAt: completed ? new Date() : null },
    update: { completedAt: completed ? (existing?.completedAt ?? new Date()) : null },
  });

  if (completed && !wasCompleted) await recordActivity(userId, 1);
  return recalculateProgress(userId, lesson.productId);
}

/** Remembers where the student is: which lesson they last opened and how far into a video they got. */
export async function saveLessonPosition(
  userId: string,
  lesson: { id: string; productId: string },
  positionSeconds: number | null,
) {
  const now = new Date();
  await Promise.all([
    positionSeconds === null
      ? Promise.resolve()
      : db.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          create: {
            userId,
            lessonId: lesson.id,
            productId: lesson.productId,
            positionSeconds: Math.max(0, Math.floor(positionSeconds)),
          },
          update: { positionSeconds: Math.max(0, Math.floor(positionSeconds)) },
        }),
    db.enrollment.updateMany({
      where: { userId, productId: lesson.productId },
      data: { lastLessonId: lesson.id, lastAccessedAt: now },
    }),
  ]);
}

/** Admin tool: wipe a student's lesson progress on a product. Certificates and completion stay. */
export async function resetProgress(userId: string, productId: string) {
  await db.$transaction([
    db.lessonProgress.deleteMany({ where: { userId, productId } }),
    db.quizAttempt.deleteMany({ where: { userId, quiz: { lesson: { productId } } } }),
    db.enrollment.updateMany({ where: { userId, productId }, data: { progressPercent: 0, lastLessonId: null } }),
  ]);
}

/** Admin tool: mark every published lesson complete (e.g. for someone who finished offline). */
export async function markProductComplete(userId: string, productId: string) {
  const lessons = await db.lesson.findMany({ where: { productId, isPublished: true }, select: { id: true } });
  const now = new Date();
  for (const lesson of lessons) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: lesson.id } },
      create: { userId, lessonId: lesson.id, productId, completedAt: now },
      update: { completedAt: now },
    });
  }
  return recalculateProgress(userId, productId);
}

export async function getStreak(userId: string) {
  const { general } = await loadSettings();
  const today = dayKey(new Date(), general.timezone);
  const since = dayKeyToDate(shiftDayKey(today, -400));
  const rows = await db.activityDay.findMany({
    where: { userId, day: { gte: since } },
    select: { day: true, lessonsCompleted: true },
    orderBy: { day: "asc" },
  });
  const keys = rows.map((row) => row.day.toISOString().slice(0, 10));
  return { ...computeStreak(keys, today), today, days: rows.map((row, index) => ({ day: keys[index], lessons: row.lessonsCompleted })) };
}
