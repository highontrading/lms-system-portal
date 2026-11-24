import { describe, expect, it } from "vitest";
import { computeLessonLocks, pickResumeLesson, progressPercent } from "@/lib/curriculum";
import { computeStreak, dayKey, fromLocalInputValue, toLocalInputValue } from "@/lib/dates";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-24T12:00:00Z");
const sections = [
  { dripDays: null, lessons: [{ id: "a", isPreview: true }, { id: "b", isPreview: false }] },
  { dripDays: 7, lessons: [{ id: "c", isPreview: false }] },
];
const base = { sections, now, completedLessonIds: new Set<string>() };

describe("lesson locks", () => {
  it("lets visitors without access open only free previews", () => {
    const locks = computeLessonLocks({ ...base, hasAccess: false, isStaff: false, enrolledAt: null, sequential: false });
    expect(locks.get("a")).toEqual({ locked: false });
    expect(locks.get("b")).toEqual({ locked: true, reason: "enroll" });
  });

  it("holds a dripped section until its unlock date", () => {
    const enrolledAt = new Date(now.getTime() - 3 * DAY);
    const locks = computeLessonLocks({ ...base, hasAccess: true, isStaff: false, enrolledAt, sequential: false });
    expect(locks.get("b")).toEqual({ locked: false });
    expect(locks.get("c")).toMatchObject({ locked: true, reason: "drip" });
    const later = computeLessonLocks({ ...base, hasAccess: true, isStaff: false, enrolledAt: new Date(now.getTime() - 8 * DAY), sequential: false });
    expect(later.get("c")).toEqual({ locked: false });
  });

  it("enforces lesson order when the product is sequential", () => {
    const enrolledAt = new Date(now.getTime() - 30 * DAY);
    const fresh = computeLessonLocks({ ...base, hasAccess: true, isStaff: false, enrolledAt, sequential: true });
    expect(fresh.get("a")).toEqual({ locked: false });
    expect(fresh.get("b")).toEqual({ locked: true, reason: "sequence" });
    const afterFirst = computeLessonLocks({
      ...base, hasAccess: true, isStaff: false, enrolledAt, sequential: true, completedLessonIds: new Set(["a"]),
    });
    expect(afterFirst.get("b")).toEqual({ locked: false });
    expect(afterFirst.get("c")).toEqual({ locked: true, reason: "sequence" });
  });

  it("never locks anything for staff", () => {
    const locks = computeLessonLocks({ ...base, hasAccess: false, isStaff: true, enrolledAt: null, sequential: true });
    expect([...locks.values()].every((lock) => !lock.locked)).toBe(true);
  });
});

describe("progress", () => {
  it("only reports 100% when everything is done", () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(199, 200)).toBe(99);
    expect(progressPercent(200, 200)).toBe(100);
    expect(progressPercent(1, 3)).toBe(33);
  });

  it("resumes at the last opened lesson, else the first unfinished one", () => {
    const lessons = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const locks = new Map(lessons.map((lesson) => [lesson.id, { locked: false as const }]));
    expect(pickResumeLesson(lessons, { lastLessonId: "b", completedLessonIds: new Set(["a"]), locks })?.id).toBe("b");
    expect(pickResumeLesson(lessons, { lastLessonId: "a", completedLessonIds: new Set(["a"]), locks })?.id).toBe("b");
    expect(pickResumeLesson(lessons, { lastLessonId: null, completedLessonIds: new Set(["a", "b", "c"]), locks })?.id).toBe("a");
  });
});

describe("dates", () => {
  it("keeps a streak alive through today and breaks it after a missed day", () => {
    expect(computeStreak(["2026-11-22", "2026-11-23", "2026-11-24"], "2026-11-24")).toMatchObject({ current: 3, longest: 3 });
    expect(computeStreak(["2026-11-22", "2026-11-23"], "2026-11-24")).toMatchObject({ current: 2, activeToday: false });
    expect(computeStreak(["2026-11-20", "2026-11-21"], "2026-11-24")).toMatchObject({ current: 0, longest: 2 });
  });

  it("round-trips wall-clock times through a time zone", () => {
    const instant = fromLocalInputValue("2026-12-01T19:30", "Asia/Kolkata")!;
    expect(instant.toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(toLocalInputValue(instant, "Asia/Kolkata")).toBe("2026-12-01T19:30");
    expect(dayKey(new Date("2026-11-24T20:00:00Z"), "Asia/Kolkata")).toBe("2026-11-25");
  });
});
