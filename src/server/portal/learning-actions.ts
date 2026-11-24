"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ActionError, userAction } from "@/server/action";
import type { SessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { getLearningContext, parseQuizOptions } from "@/server/portal/learning";
import { saveLessonPosition, setLessonCompletion } from "@/server/progress";

/**
 * Every learner action starts here: the lesson must exist, the user must hold access to its
 * product (or be staff), and the lesson must not be locked by drip or sequence rules.
 */
async function openLesson(user: SessionUser, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, productId: true, type: true, isPublished: true, product: { select: { slug: true } } },
  });
  if (!lesson || !lesson.isPublished) throw new ActionError("That lesson is no longer available.");

  const ctx = await getLearningContext(lesson.product.slug, user);
  if (!ctx || !ctx.hasAccess) throw new ActionError("You don't have access to this product.");
  if (ctx.locks[lesson.id]?.locked) throw new ActionError("This lesson is still locked.");
  return { lesson, ctx };
}

export const setLessonComplete = userAction(
  z.object({ lessonId: z.string().min(1), completed: z.boolean() }),
  async ({ lessonId, completed }, { user }) => {
    const { lesson, ctx } = await openLesson(user, lessonId);

    if (completed && lesson.type === "QUIZ" && !ctx.staff) {
      const passed = await db.quizAttempt.count({ where: { userId: user.id, passed: true, quiz: { lessonId } } });
      if (passed === 0) throw new ActionError("Pass the quiz to complete this lesson.");
    }

    const result = await setLessonCompletion(user.id, { id: lesson.id, productId: lesson.productId }, completed);
    return {
      percent: result?.percent ?? ctx.percent,
      productCompleted: !!result?.newlyCompleted,
      certificateSerial: result?.certificateSerial ?? null,
    };
  },
);

/** Remembers the last lesson opened and (for videos) how far the learner got. */
export const saveProgress = userAction(
  z.object({
    lessonId: z.string().min(1),
    positionSeconds: z
      .number()
      .min(0)
      .max(60 * 60 * 24)
      .nullable(),
  }),
  async ({ lessonId, positionSeconds }, { user }) => {
    const { lesson } = await openLesson(user, lessonId);
    await saveLessonPosition(user.id, { id: lesson.id, productId: lesson.productId }, positionSeconds);
  },
  { refresh: false },
);

export const submitQuiz = userAction(
  z.object({
    lessonId: z.string().min(1),
    answers: z.record(z.string(), z.array(z.string().max(500)).max(30)),
  }),
  async ({ lessonId, answers }, { user }) => {
    const { lesson } = await openLesson(user, lessonId);
    const quiz = await db.quiz.findUnique({
      where: { lessonId },
      include: { questions: { orderBy: { position: "asc" } } },
    });
    if (!quiz || quiz.questions.length === 0) throw new ActionError("This quiz doesn't have any questions yet.");

    const used = await db.quizAttempt.count({ where: { quizId: quiz.id, userId: user.id, submittedAt: { not: null } } });
    if (quiz.maxAttempts && used >= quiz.maxAttempts) throw new ActionError("You've used all your attempts for this quiz.");

    let score = 0;
    let maxScore = 0;
    const review = quiz.questions.map((question) => {
      const options = parseQuizOptions(question.options);
      const given = answers[question.id] ?? [];
      const correctIds = options.filter((option) => option.correct).map((option) => option.id);
      let correct: boolean;
      if (question.type === "SHORT") {
        const typed = (given[0] ?? "").trim().toLowerCase();
        correct = typed.length > 0 && options.some((option) => option.text.trim().toLowerCase() === typed);
      } else {
        const chosen = new Set(given);
        correct = correctIds.length > 0 && chosen.size === correctIds.length && correctIds.every((id) => chosen.has(id));
      }
      maxScore += question.points;
      if (correct) score += question.points;
      return { questionId: question.id, correct, correctOptionIds: correctIds, explanation: question.explanation };
    });

    const percent = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passed = percent >= quiz.passPercent;

    await db.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user.id,
        answers: answers as Prisma.InputJsonValue,
        score,
        maxScore,
        percent,
        passed,
        submittedAt: new Date(),
      },
    });

    const completion = passed
      ? await setLessonCompletion(user.id, { id: lesson.id, productId: lesson.productId }, true)
      : null;

    return {
      percent,
      passed,
      score,
      maxScore,
      passPercent: quiz.passPercent,
      attemptsLeft: quiz.maxAttempts ? Math.max(0, quiz.maxAttempts - used - 1) : null,
      // The answer key only leaves the server after grading, and only when the quiz allows it.
      review: quiz.showAnswers ? review : review.map((item) => ({ questionId: item.questionId, correct: item.correct })),
      showAnswers: quiz.showAnswers,
      productCompleted: !!completion?.newlyCompleted,
      certificateSerial: completion?.certificateSerial ?? null,
    };
  },
);

export const saveNote = userAction(
  z.object({
    lessonId: z.string().min(1),
    noteId: z.string().min(1).optional(),
    body: z.string().trim().min(1, "Write something first").max(5000, "Notes can be up to 5,000 characters"),
    positionSeconds: z.number().int().min(0).nullable().optional(),
  }),
  async ({ lessonId, noteId, body, positionSeconds }, { user }) => {
    if (noteId) {
      const updated = await db.note.updateMany({ where: { id: noteId, userId: user.id }, data: { body } });
      if (updated.count === 0) throw new ActionError("That note no longer exists.");
      return { id: noteId };
    }
    const { lesson } = await openLesson(user, lessonId);
    const note = await db.note.create({
      data: { userId: user.id, lessonId: lesson.id, productId: lesson.productId, body, positionSeconds: positionSeconds ?? null },
    });
    return { id: note.id };
  },
);

export const deleteNote = userAction(z.object({ noteId: z.string().min(1) }), async ({ noteId }, { user }) => {
  await db.note.deleteMany({ where: { id: noteId, userId: user.id } });
});

const JOIN_OPENS_MINUTES = 15;
const JOIN_GRACE_MINUTES = 30;

/** Hands out the meeting link (only inside the join window, only to people with access) and records attendance. */
export const joinLiveSession = userAction(
  z.object({ sessionId: z.string().min(1) }),
  async ({ sessionId }, { user }) => {
    const session = await db.liveSession.findUnique({
      where: { id: sessionId },
      include: { product: { select: { slug: true } } },
    });
    if (!session) throw new ActionError("That session no longer exists.");

    const ctx = await getLearningContext(session.product.slug, user);
    if (!ctx || !ctx.hasAccess) throw new ActionError("You don't have access to this session.");
    if (session.status === "CANCELLED") throw new ActionError("This session was cancelled.");
    if (!session.meetingUrl) throw new ActionError("The join link hasn't been added yet. Please check back shortly.");

    const now = Date.now();
    const opens = session.startsAt.getTime() - JOIN_OPENS_MINUTES * 60_000;
    const closes = session.startsAt.getTime() + (session.durationMinutes + JOIN_GRACE_MINUTES) * 60_000;
    if (!ctx.staff && now < opens) throw new ActionError(`This session opens ${JOIN_OPENS_MINUTES} minutes before it starts.`);
    if (!ctx.staff && (now > closes || session.status === "ENDED")) throw new ActionError("This session has ended.");

    await db.liveAttendance.upsert({
      where: { sessionId_userId: { sessionId, userId: user.id } },
      create: { sessionId, userId: user.id },
      update: {},
    });
    return { url: session.meetingUrl };
  },
  { refresh: false },
);
