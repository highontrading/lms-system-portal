import "server-only";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { computeLessonLocks, pickResumeLesson, progressPercent, type LockReason } from "@/lib/curriculum";
import { isStaff } from "@/lib/permissions";
import { isEnrollmentActive } from "@/server/access";
import type { SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";

/** Lock state in a shape that can be passed to client components. */
export type SerializedLock = { locked: boolean; reason?: LockReason; unlockAt?: string };

const loadContext = cache(async (slug: string, userId: string, role: Role) => {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, type: true, durationSeconds: true, isPreview: true, sectionId: true },
          },
        },
      },
      assets: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { lesson: { select: { id: true, title: true, isPublished: true } } },
      },
      liveSessions: { orderBy: { startsAt: "asc" } },
      updates: { orderBy: { publishedAt: "desc" } },
      bundleItems: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: { id: true, slug: true, title: true, tagline: true, type: true, thumbnailUrl: true, status: true },
          },
        },
      },
    },
  });
  if (!product) return null;

  const staff = isStaff(role);
  const [enrollment, progressRows, certificate] = await Promise.all([
    db.enrollment.findUnique({ where: { userId_productId: { userId, productId: product.id } } }),
    db.lessonProgress.findMany({
      where: { userId, productId: product.id },
      select: { lessonId: true, completedAt: true, positionSeconds: true },
    }),
    db.certificate.findUnique({ where: { userId_productId: { userId, productId: product.id } } }),
  ]);
  const active = isEnrollmentActive(enrollment);

  // Drafts are for staff only. Archived products stay available to the people who already own them.
  if (product.status === "DRAFT" && !staff) return null;
  if (product.status === "ARCHIVED" && !staff && !active) return null;

  const completedLessonIds = new Set(progressRows.filter((row) => row.completedAt).map((row) => row.lessonId));
  const positions: Record<string, number> = {};
  for (const row of progressRows) positions[row.lessonId] = row.positionSeconds;

  const now = new Date();
  const lockMap = computeLessonLocks({
    hasAccess: active,
    isStaff: staff,
    enrolledAt: enrollment?.createdAt ?? null,
    sequential: product.sequential,
    now,
    sections: product.sections,
    completedLessonIds,
  });

  const locks: Record<string, SerializedLock> = {};
  for (const [lessonId, lock] of lockMap) {
    locks[lessonId] = lock.locked
      ? { locked: true, reason: lock.reason, unlockAt: lock.unlockAt?.toISOString() }
      : { locked: false };
  }

  const sections = product.sections.filter((section) => section.lessons.length > 0);
  const lessons = sections.flatMap((section) =>
    section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title })),
  );
  const completedCount = lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length;
  const hasAccess = active || staff;
  const resumeLesson = hasAccess
    ? pickResumeLesson(lessons, { lastLessonId: enrollment?.lastLessonId ?? null, completedLessonIds, locks: lockMap })
    : null;

  return {
    product,
    sections,
    lessons,
    enrollment,
    /** The viewer holds an active enrolment. */
    active,
    staff,
    /** May open the content: an active enrolment, or a staff member previewing. */
    hasAccess,
    lapsed: !!enrollment && !active,
    completedLessonIds,
    positions,
    locks,
    totalLessons: lessons.length,
    completedCount,
    percent: progressPercent(completedCount, lessons.length),
    resumeLesson,
    certificate: certificate && !certificate.revokedAt ? certificate : null,
  };
});

/**
 * Everything needed to render a product for a learner: its content, what they have finished,
 * and — for every lesson — whether they may open it. Deduplicated per request so the player
 * layout and the lesson page share one set of queries.
 */
export function getLearningContext(slug: string, user: Pick<SessionUser, "id" | "role">) {
  return loadContext(slug, user.id, user.role);
}

export type LearningContext = NonNullable<Awaited<ReturnType<typeof getLearningContext>>>;

/** One lesson with everything the player shows for it. */
export async function getLessonDetail(productId: string, lessonId: string, userId: string) {
  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, productId, isPublished: true },
    include: {
      assets: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      quiz: { include: { questions: { orderBy: { position: "asc" } } } },
      assignment: true,
    },
  });
  if (!lesson) return null;

  const [notes, attempts] = await Promise.all([
    db.note.findMany({ where: { userId, lessonId }, orderBy: { createdAt: "desc" } }),
    lesson.quiz
      ? db.quizAttempt.findMany({
          where: { userId, quizId: lesson.quiz.id, submittedAt: { not: null } },
          orderBy: { submittedAt: "desc" },
          select: { id: true, percent: true, passed: true, score: true, maxScore: true, submittedAt: true },
        })
      : Promise.resolve([]),
  ]);

  return { lesson, notes, attempts };
}

export type QuizOption = { id: string; text: string; correct?: boolean };

/** Options as stored (with the answer key). Never send this to the browser before grading. */
export function parseQuizOptions(value: unknown): QuizOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { id: unknown; text: unknown; correct?: unknown } => !!item && typeof item === "object")
    .map((item) => ({ id: String(item.id), text: String(item.text ?? ""), correct: item.correct === true }));
}

/** Upcoming and past live sessions across everything the user currently owns. */
export async function getLiveSessionsForUser(userId: string) {
  const now = new Date();
  const enrollments = await db.enrollment.findMany({
    where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { productId: true },
  });
  const productIds = enrollments.map((enrollment) => enrollment.productId);
  if (productIds.length === 0) return [];
  return db.liveSession.findMany({
    where: { productId: { in: productIds }, product: { status: { not: "DRAFT" } } },
    orderBy: { startsAt: "asc" },
    include: { product: { select: { slug: true, title: true, type: true } } },
  });
}
