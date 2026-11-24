"use server";

import { after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fromLocalInputValue } from "@/lib/dates";
import { vimeoId, youtubeId } from "@/lib/video";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { sendBulkEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { sanitizeRichText } from "@/server/sanitize";
import { loadSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

const PERMISSION = "products.manage" as const;

const id = z.string().min(1).max(60);
const title = (label: string) => z.string().trim().min(1, `Give the ${label} a title`).max(160);
const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

function isHttpUrl(value: string, httpsOnly = false) {
  try {
    const url = new URL(value);
    return httpsOnly ? url.protocol === "https:" : url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ───────────────────────────── Ownership checks ─────────────────────────────
// Every action receives the product id from the page it was called on and verifies that the
// thing being changed really belongs to that product.

async function requireProduct(productId: string) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, slug: true, type: true, version: true },
  });
  if (!product) throw new ActionError("That product no longer exists.");
  return product;
}

async function requireSection(productId: string, sectionId: string) {
  const section = await db.section.findFirst({ where: { id: sectionId, productId } });
  if (!section) throw new ActionError("That section no longer exists. Refresh the page and try again.");
  return section;
}

async function requireLesson(productId: string, lessonId: string) {
  const lesson = await db.lesson.findFirst({ where: { id: lessonId, productId } });
  if (!lesson) throw new ActionError("That lesson no longer exists. Refresh the page and try again.");
  return lesson;
}

/**
 * Lesson counts changed (added, removed, published, hidden): bring every student's stored
 * progress percentage back in line. Completion dates and certificates are never taken away.
 */
async function refreshProductProgress(productId: string) {
  await db.$executeRaw`
    UPDATE "Enrollment" e SET "progressPercent" = (
      SELECT CASE
        WHEN t.total = 0 THEN 0
        WHEN d.done >= t.total THEN 100
        ELSE LEAST(99, ROUND(d.done::numeric * 100 / t.total))::int
      END
      FROM (SELECT count(*)::int AS total FROM "Lesson" WHERE "productId" = ${productId} AND "isPublished") t,
           (SELECT count(*)::int AS done
              FROM "LessonProgress" lp JOIN "Lesson" l ON l.id = lp."lessonId"
             WHERE lp."userId" = e."userId" AND lp."productId" = ${productId}
               AND lp."completedAt" IS NOT NULL AND l."isPublished") d
    )
    WHERE e."productId" = ${productId}
  `;
}

// ───────────────────────────── Sections ─────────────────────────────

export const createSection = staffAction(
  PERMISSION,
  z.object({ productId: id, title: title("section") }),
  async (input, { user }) => {
    const product = await requireProduct(input.productId);
    const last = await db.section.findFirst({
      where: { productId: product.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const section = await db.section.create({
      data: { productId: product.id, title: input.title, position: (last?.position ?? -1) + 1 },
    });
    await audit(user, "section.create", `Added section “${section.title}” to ${product.title}`, {
      entityType: "product",
      entityId: product.id,
    });
    return { id: section.id };
  },
);

export const updateSection = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    sectionId: id,
    title: title("section"),
    dripDays: z.number().int().min(0).max(3650).nullable(),
  }),
  async (input) => {
    await requireSection(input.productId, input.sectionId);
    await db.section.update({
      where: { id: input.sectionId },
      data: { title: input.title, dripDays: input.dripDays && input.dripDays > 0 ? input.dripDays : null },
    });
  },
);

export const deleteSection = staffAction(
  PERMISSION,
  z.object({ productId: id, sectionId: id }),
  async (input, { user }) => {
    const section = await requireSection(input.productId, input.sectionId);
    await db.section.delete({ where: { id: section.id } });
    await refreshProductProgress(input.productId);
    await audit(user, "section.delete", `Deleted section “${section.title}” and its lessons`, {
      entityType: "product",
      entityId: input.productId,
    });
  },
);

/** Saves the whole ordering in one go: section order, lesson order, and which section each lesson sits in. */
export const reorderCurriculum = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    sections: z.array(z.object({ id, lessonIds: z.array(id).max(500) })).max(200),
  }),
  async (input) => {
    const [sections, lessons] = await Promise.all([
      db.section.findMany({ where: { productId: input.productId }, select: { id: true } }),
      db.lesson.findMany({ where: { productId: input.productId }, select: { id: true } }),
    ]);
    const sectionIds = new Set(sections.map((section) => section.id));
    const lessonIds = new Set(lessons.map((lesson) => lesson.id));
    const seen = new Set<string>();
    for (const section of input.sections) {
      if (!sectionIds.has(section.id)) throw new ActionError("The content changed elsewhere. Refresh and try again.");
      for (const lessonId of section.lessonIds) {
        if (!lessonIds.has(lessonId) || seen.has(lessonId)) {
          throw new ActionError("The content changed elsewhere. Refresh and try again.");
        }
        seen.add(lessonId);
      }
    }

    await db.$transaction([
      ...input.sections.map((section, index) =>
        db.section.update({ where: { id: section.id }, data: { position: index } }),
      ),
      ...input.sections.flatMap((section) =>
        section.lessonIds.map((lessonId, index) =>
          db.lesson.update({ where: { id: lessonId }, data: { sectionId: section.id, position: index } }),
        ),
      ),
    ]);
  },
  { refresh: false },
);

// ───────────────────────────── Lessons ─────────────────────────────

const lessonType = z.enum(["VIDEO", "TEXT", "QUIZ", "DOWNLOAD", "EMBED"]);

export const createLesson = staffAction(
  PERMISSION,
  z.object({ productId: id, sectionId: id, title: title("lesson"), type: lessonType }),
  async (input, { user }) => {
    const section = await requireSection(input.productId, input.sectionId);
    const last = await db.lesson.findFirst({
      where: { sectionId: section.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const lesson = await db.lesson.create({
      data: {
        productId: input.productId,
        sectionId: section.id,
        title: input.title,
        type: input.type,
        position: (last?.position ?? -1) + 1,
        // New lessons start hidden so students never see a half-finished one.
        isPublished: false,
        ...(input.type === "QUIZ" ? { quiz: { create: {} } } : {}),
      },
    });
    await audit(user, "lesson.create", `Added lesson “${lesson.title}”`, { entityType: "lesson", entityId: lesson.id });
    return { id: lesson.id };
  },
);

export const updateLessonMeta = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    lessonId: id,
    title: title("lesson").optional(),
    isPublished: z.boolean().optional(),
    isPreview: z.boolean().optional(),
  }),
  async (input) => {
    const lesson = await requireLesson(input.productId, input.lessonId);
    await db.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.isPreview !== undefined ? { isPreview: input.isPreview } : {}),
      },
    });
    if (input.isPublished !== undefined && input.isPublished !== lesson.isPublished) {
      await refreshProductProgress(input.productId);
    }
  },
);

export const deleteLesson = staffAction(
  PERMISSION,
  z.object({ productId: id, lessonId: id }),
  async (input, { user }) => {
    const lesson = await requireLesson(input.productId, input.lessonId);
    await db.lesson.delete({ where: { id: lesson.id } });
    await refreshProductProgress(input.productId);
    await audit(user, "lesson.delete", `Deleted lesson “${lesson.title}”`, {
      entityType: "product",
      entityId: input.productId,
    });
  },
);

const videoProvider = z.enum(["YOUTUBE", "VIMEO", "BUNNY", "UPLOAD", "URL"]);

/** Returns a message when a video source can't be played, otherwise null. */
function videoProblem(provider: z.infer<typeof videoProvider>, url: string) {
  if (provider === "YOUTUBE") return youtubeId(url) ? null : "That doesn't look like a YouTube link.";
  if (provider === "VIMEO") return vimeoId(url) ? null : "That doesn't look like a Vimeo link.";
  if (provider === "BUNNY") return isHttpUrl(url, true) ? null : "Paste the Bunny Stream embed URL (https://…).";
  if (provider === "UPLOAD") return url.startsWith("/files/") ? null : "Upload the video file again.";
  return isHttpUrl(url) || (url.startsWith("/") && !url.startsWith("//")) ? null : "Enter a full video address (https://…).";
}

const quizOption = z.object({
  id: z.string().min(1).max(60),
  text: z.string().trim().min(1, "Fill in every answer option").max(500),
  correct: z.boolean(),
});

const quizQuestion = z
  .object({
    id: z.string().max(60).optional(),
    type: z.enum(["SINGLE", "MULTIPLE", "TRUE_FALSE"]),
    prompt: z.string().trim().min(1, "Write the question").max(2000),
    options: z.array(quizOption).min(2, "Add at least two answer options").max(10),
    explanation: optionalText(2000),
    points: z.number().int().min(1).max(100).default(1),
  })
  .superRefine((question, ctx) => {
    const correct = question.options.filter((option) => option.correct).length;
    if (correct === 0) ctx.addIssue({ code: "custom", message: "Mark the correct answer", path: ["options"] });
    if (question.type !== "MULTIPLE" && correct > 1) {
      ctx.addIssue({ code: "custom", message: "Only one answer can be correct for this question type", path: ["options"] });
    }
  });

const quizInput = z.object({
  passPercent: z.number().int().min(1).max(100),
  maxAttempts: z.number().int().min(1).max(100).nullable(),
  showAnswers: z.boolean(),
  questions: z.array(quizQuestion).max(200),
});

export const saveLesson = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    lessonId: id,
    title: title("lesson"),
    isPublished: z.boolean(),
    isPreview: z.boolean(),
    durationMinutes: z.number().min(0).max(100000).nullable(),
    content: z.string().max(400_000).optional().default(""),
    videoProvider: videoProvider.nullable().optional(),
    videoUrl: z.string().trim().max(1000).optional().default(""),
    embedUrl: z.string().trim().max(1000).optional().default(""),
    quiz: quizInput.optional(),
  }),
  async (input, { user }) => {
    const lesson = await requireLesson(input.productId, input.lessonId);

    const data: Prisma.LessonUpdateInput = {
      title: input.title,
      isPublished: input.isPublished,
      isPreview: input.isPreview,
      durationSeconds: input.durationMinutes ? Math.round(input.durationMinutes * 60) : null,
      content: sanitizeRichText(input.content) || null,
    };

    if (lesson.type === "VIDEO") {
      if (input.videoUrl) {
        const provider = input.videoProvider ?? "URL";
        const problem = videoProblem(provider, input.videoUrl);
        if (problem) throw new ActionError("Please check the highlighted fields.", { videoUrl: problem });
        data.videoProvider = provider;
        data.videoUrl = input.videoUrl;
      } else {
        if (input.isPublished) {
          throw new ActionError("Please check the highlighted fields.", { videoUrl: "Add a video before publishing this lesson." });
        }
        data.videoProvider = null;
        data.videoUrl = null;
      }
    }

    if (lesson.type === "EMBED") {
      if (input.embedUrl && !isHttpUrl(input.embedUrl, true)) {
        throw new ActionError("Please check the highlighted fields.", { embedUrl: "Use a secure address starting with https://" });
      }
      if (!input.embedUrl && input.isPublished) {
        throw new ActionError("Please check the highlighted fields.", { embedUrl: "Add the page to embed before publishing." });
      }
      data.embedUrl = input.embedUrl || null;
    }

    if (lesson.type === "QUIZ") {
      if (!input.quiz) throw new ActionError("The quiz details are missing. Refresh and try again.");
      if (input.isPublished && input.quiz.questions.length === 0) {
        throw new ActionError("Add at least one question before publishing this quiz.");
      }
    }

    await db.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id: lesson.id }, data });

      if (lesson.type === "QUIZ" && input.quiz) {
        const quiz = await tx.quiz.upsert({
          where: { lessonId: lesson.id },
          create: {
            lessonId: lesson.id,
            passPercent: input.quiz.passPercent,
            maxAttempts: input.quiz.maxAttempts,
            showAnswers: input.quiz.showAnswers,
          },
          update: {
            passPercent: input.quiz.passPercent,
            maxAttempts: input.quiz.maxAttempts,
            showAnswers: input.quiz.showAnswers,
          },
        });

        // Keep existing question ids so earlier attempts still line up with their questions.
        const existing = await tx.question.findMany({ where: { quizId: quiz.id }, select: { id: true } });
        const existingIds = new Set(existing.map((question) => question.id));
        const keptIds = new Set<string>();

        for (const [index, question] of input.quiz.questions.entries()) {
          const fields = {
            type: question.type,
            prompt: question.prompt,
            options: question.options as Prisma.InputJsonValue,
            explanation: question.explanation || null,
            points: question.points,
            position: index,
          };
          if (question.id && existingIds.has(question.id)) {
            keptIds.add(question.id);
            await tx.question.update({ where: { id: question.id }, data: fields });
          } else {
            await tx.question.create({ data: { quizId: quiz.id, ...fields } });
          }
        }
        const removed = [...existingIds].filter((questionId) => !keptIds.has(questionId));
        if (removed.length > 0) await tx.question.deleteMany({ where: { id: { in: removed } } });
      }
    });

    if (input.isPublished !== lesson.isPublished) await refreshProductProgress(input.productId);
    await audit(user, "lesson.update", `Updated lesson “${input.title}”`, { entityType: "lesson", entityId: lesson.id });
  },
);

// ───────────────────────────── Files, links and snippets ─────────────────────────────

const assetInput = z.object({
  productId: id,
  /** null = a product-level deliverable; otherwise a resource attached to that lesson. */
  lessonId: id.nullable(),
  assetId: id.optional(),
  kind: z.enum(["FILE", "LINK", "SNIPPET"]),
  title: z.string().trim().min(1, "Give it a title").max(160),
  description: optionalText(500),
  version: optionalText(40),
  url: z.string().trim().max(1000).optional().default(""),
  fileKey: z.string().max(400).optional().default(""),
  fileName: z.string().max(200).optional().default(""),
  fileSize: z.number().int().min(0).nullable().optional(),
  mimeType: z.string().max(120).optional().default(""),
  content: z.string().max(200_000).optional().default(""),
  language: optionalText(40),
});

export const saveAsset = staffAction(PERMISSION, assetInput, async (input, { user }) => {
  const product = await requireProduct(input.productId);
  if (input.lessonId) await requireLesson(product.id, input.lessonId);

  const data: Prisma.AssetUncheckedCreateInput = {
    productId: product.id,
    lessonId: input.lessonId,
    kind: input.kind,
    title: input.title,
    description: input.description || null,
    version: input.version || null,
    url: null,
    fileKey: null,
    fileName: null,
    fileSize: null,
    mimeType: null,
    content: null,
    language: null,
  };

  if (input.kind === "LINK") {
    if (!isHttpUrl(input.url)) throw new ActionError("Please check the highlighted fields.", { url: "Enter a full address starting with https://" });
    data.url = input.url;
  } else if (input.kind === "SNIPPET") {
    if (!input.content.trim()) throw new ActionError("Please check the highlighted fields.", { content: "Paste the text to share" });
    data.content = input.content;
    data.language = input.language || null;
  } else {
    if (!input.fileKey) throw new ActionError("Please check the highlighted fields.", { fileKey: "Upload a file first" });
    // Only files that really went through our upload flow can be attached.
    const media = await db.media.findUnique({ where: { key: input.fileKey } });
    if (!media) throw new ActionError("That upload couldn't be found. Please upload the file again.");
    data.fileKey = media.key;
    data.fileName = input.fileName || media.fileName;
    data.fileSize = media.size;
    data.mimeType = media.mimeType;
  }

  if (input.assetId) {
    const existing = await db.asset.findFirst({ where: { id: input.assetId, productId: product.id } });
    if (!existing) throw new ActionError("That item no longer exists. Refresh the page and try again.");
    await db.asset.update({ where: { id: existing.id }, data });
    return { id: existing.id };
  }

  const last = await db.asset.findFirst({
    where: { productId: product.id, lessonId: input.lessonId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const asset = await db.asset.create({ data: { ...data, position: (last?.position ?? -1) + 1 } });
  await audit(user, "asset.create", `Added “${asset.title}” to ${product.title}`, { entityType: "product", entityId: product.id });
  return { id: asset.id };
});

export const deleteAsset = staffAction(
  PERMISSION,
  z.object({ productId: id, assetId: id }),
  async (input, { user }) => {
    const asset = await db.asset.findFirst({ where: { id: input.assetId, productId: input.productId } });
    if (!asset) throw new ActionError("That item no longer exists.");
    await db.asset.delete({ where: { id: asset.id } });
    await audit(user, "asset.delete", `Removed “${asset.title}”`, { entityType: "product", entityId: input.productId });
  },
);

export const reorderAssets = staffAction(
  PERMISSION,
  z.object({ productId: id, lessonId: id.nullable(), ids: z.array(id).max(500) }),
  async (input) => {
    const assets = await db.asset.findMany({
      where: { productId: input.productId, lessonId: input.lessonId },
      select: { id: true },
    });
    const known = new Set(assets.map((asset) => asset.id));
    if (input.ids.some((assetId) => !known.has(assetId))) {
      throw new ActionError("The list changed elsewhere. Refresh and try again.");
    }
    await db.$transaction(input.ids.map((assetId, index) => db.asset.update({ where: { id: assetId }, data: { position: index } })));
  },
);

// ───────────────────────────── Live sessions ─────────────────────────────

export const saveLiveSession = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    sessionId: id.optional(),
    title: title("session"),
    description: optionalText(4000),
    /** Wall-clock value from a datetime-local input, read in the site's time zone. */
    startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Pick a date and time"),
    durationMinutes: z.number().int().min(5, "At least 5 minutes").max(1440),
    platform: optionalText(60),
    meetingUrl: z.string().trim().max(1000).optional().default(""),
    meetingPasscode: optionalText(100),
    status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]),
    recordingProvider: videoProvider.nullable().optional(),
    recordingUrl: z.string().trim().max(1000).optional().default(""),
  }),
  async (input, { user }) => {
    const product = await requireProduct(input.productId);
    const { general } = await loadSettings();
    const startsAt = fromLocalInputValue(input.startsAtLocal, general.timezone);
    if (!startsAt) throw new ActionError("Please check the highlighted fields.", { startsAtLocal: "Pick a date and time" });
    if (input.meetingUrl && !isHttpUrl(input.meetingUrl)) {
      throw new ActionError("Please check the highlighted fields.", { meetingUrl: "Enter a full address starting with https://" });
    }
    if (input.recordingUrl) {
      const problem = videoProblem(input.recordingProvider ?? "URL", input.recordingUrl);
      if (problem) throw new ActionError("Please check the highlighted fields.", { recordingUrl: problem });
    }

    const data = {
      title: input.title,
      description: input.description || null,
      startsAt,
      durationMinutes: input.durationMinutes,
      platform: input.platform || null,
      meetingUrl: input.meetingUrl || null,
      meetingPasscode: input.meetingPasscode || null,
      status: input.status,
      recordingProvider: input.recordingUrl ? (input.recordingProvider ?? "URL") : null,
      recordingUrl: input.recordingUrl || null,
    };

    if (input.sessionId) {
      const existing = await db.liveSession.findFirst({ where: { id: input.sessionId, productId: product.id } });
      if (!existing) throw new ActionError("That session no longer exists. Refresh the page and try again.");
      await db.liveSession.update({
        where: { id: existing.id },
        data: {
          ...data,
          // A rescheduled session should send its reminders again.
          ...(existing.startsAt.getTime() !== startsAt.getTime() ? { reminderDaySentAt: null, reminderHourSentAt: null } : {}),
        },
      });
      return { id: existing.id };
    }

    const session = await db.liveSession.create({ data: { productId: product.id, ...data } });
    await audit(user, "live.create", `Scheduled “${session.title}” for ${product.title}`, {
      entityType: "product",
      entityId: product.id,
    });
    return { id: session.id };
  },
);

export const deleteLiveSession = staffAction(
  PERMISSION,
  z.object({ productId: id, sessionId: id }),
  async (input, { user }) => {
    const session = await db.liveSession.findFirst({ where: { id: input.sessionId, productId: input.productId } });
    if (!session) throw new ActionError("That session no longer exists.");
    await db.liveSession.delete({ where: { id: session.id } });
    await audit(user, "live.delete", `Deleted session “${session.title}”`, { entityType: "product", entityId: input.productId });
  },
);

// ───────────────────────────── Updates (changelog) ─────────────────────────────

export const saveProductUpdate = staffAction(
  PERMISSION,
  z.object({
    productId: id,
    updateId: id.optional(),
    version: optionalText(40),
    title: title("update"),
    body: z.string().max(200_000),
    notifyStudents: z.boolean().optional().default(false),
    emailStudents: z.boolean().optional().default(false),
  }),
  async (input, { user }) => {
    const product = await requireProduct(input.productId);
    const body = sanitizeRichText(input.body);
    if (!body) throw new ActionError("Please check the highlighted fields.", { body: "Describe what changed" });
    const version = input.version.replace(/^v/i, "") || null;

    if (input.updateId) {
      const existing = await db.productUpdate.findFirst({ where: { id: input.updateId, productId: product.id } });
      if (!existing) throw new ActionError("That update no longer exists. Refresh the page and try again.");
      await db.productUpdate.update({ where: { id: existing.id }, data: { version, title: input.title, body } });
      return { id: existing.id, notified: 0 };
    }

    const update = await db.productUpdate.create({
      data: { productId: product.id, version, title: input.title, body },
    });
    if (version) await db.product.update({ where: { id: product.id }, data: { version } });

    let notified = 0;
    if (input.notifyStudents || input.emailStudents) {
      const now = new Date();
      const enrollments = await db.enrollment.findMany({
        where: { productId: product.id, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { userId: true, user: { select: { email: true, status: true, emailAnnouncements: true } } },
      });
      const active = enrollments.filter((enrollment) => enrollment.user.status === "ACTIVE");
      notified = active.length;
      const href = `/learn/${product.slug}?tab=updates`;

      if (input.notifyStudents) {
        await notify(
          active.map((enrollment) => enrollment.userId),
          {
            type: "update",
            title: `${product.title}: ${input.title}`,
            body: version ? `Version ${version} is available.` : "There's a new update.",
            href,
          },
        );
      }
      if (input.emailStudents) {
        const recipients = active
          .filter((enrollment) => enrollment.user.emailAnnouncements)
          .map((enrollment) => enrollment.user.email);
        if (recipients.length > 0) {
          // Sending can take a while for a large audience; do it after the response.
          after(() =>
            sendBulkEmail(
              recipients,
              "product-update",
              emails.productUpdate({
                name: "there",
                productTitle: product.title,
                version,
                title: input.title,
                url: absoluteUrl(href),
              }),
            ),
          );
        }
      }
    }

    await audit(user, "update.publish", `Published update “${input.title}” for ${product.title}`, {
      entityType: "product",
      entityId: product.id,
    });
    return { id: update.id, notified };
  },
);

export const deleteProductUpdate = staffAction(
  PERMISSION,
  z.object({ productId: id, updateId: id }),
  async (input, { user }) => {
    const update = await db.productUpdate.findFirst({ where: { id: input.updateId, productId: input.productId } });
    if (!update) throw new ActionError("That update no longer exists.");
    await db.productUpdate.delete({ where: { id: update.id } });
    await audit(user, "update.delete", `Deleted update “${update.title}”`, { entityType: "product", entityId: input.productId });
  },
);
