import { addDays } from "@/lib/dates";

export type LockReason = "enroll" | "drip" | "sequence";

export type LessonLock = { locked: false } | { locked: true; reason: LockReason; unlockAt?: Date };

export type LockInput = {
  hasAccess: boolean;
  /** Staff preview everything. */
  isStaff: boolean;
  enrolledAt: Date | null;
  /** Lessons must be completed in order. */
  sequential: boolean;
  now: Date;
  sections: {
    dripDays: number | null;
    lessons: { id: string; isPreview: boolean }[];
  }[];
  completedLessonIds: Set<string>;
};

/**
 * Decides, for every lesson, whether the viewer may open it and — if not — why.
 * Kept free of database access so the rules are easy to test.
 */
export function computeLessonLocks(input: LockInput) {
  const locks = new Map<string, LessonLock>();
  let blockedBySequence = false;

  for (const section of input.sections) {
    const unlockAt =
      section.dripDays && section.dripDays > 0 && input.enrolledAt ? addDays(input.enrolledAt, section.dripDays) : null;
    const dripLocked = !!unlockAt && unlockAt > input.now;

    for (const lesson of section.lessons) {
      if (input.isStaff) {
        locks.set(lesson.id, { locked: false });
        continue;
      }
      if (!input.hasAccess) {
        locks.set(lesson.id, lesson.isPreview ? { locked: false } : { locked: true, reason: "enroll" });
        continue;
      }
      if (dripLocked) {
        locks.set(lesson.id, { locked: true, reason: "drip", unlockAt: unlockAt ?? undefined });
        // Later lessons can't be reached in order until this one opens.
        if (input.sequential) blockedBySequence = true;
        continue;
      }
      const done = input.completedLessonIds.has(lesson.id);
      if (input.sequential && blockedBySequence && !done) {
        locks.set(lesson.id, { locked: true, reason: "sequence" });
        continue;
      }
      locks.set(lesson.id, { locked: false });
      if (input.sequential && !done) blockedBySequence = true;
    }
  }

  return locks;
}

/** Whole-number progress. Only reports 100 when every lesson is done. */
export function progressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  if (completed >= total) return 100;
  return Math.min(99, Math.round((completed / total) * 100));
}

/** The lesson to resume: the last one opened if still available, otherwise the first unfinished one. */
export function pickResumeLesson<T extends { id: string }>(
  lessons: T[],
  options: { lastLessonId: string | null; completedLessonIds: Set<string>; locks: Map<string, LessonLock> },
) {
  const open = lessons.filter((lesson) => !options.locks.get(lesson.id)?.locked);
  if (open.length === 0) return null;
  const last = open.find((lesson) => lesson.id === options.lastLessonId);
  if (last && !options.completedLessonIds.has(last.id)) return last;
  return open.find((lesson) => !options.completedLessonIds.has(lesson.id)) ?? last ?? open[0];
}
