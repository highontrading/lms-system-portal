import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetManager } from "@/components/admin/content/asset-manager";
import { LessonEditor, type LessonEditorData } from "@/components/admin/content/lesson-editor";
import type { QuizQuestionDraft } from "@/components/admin/content/quiz-builder";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Edit lesson" };

type StoredOption = { id?: unknown; text?: unknown; correct?: unknown };

function readOptions(value: unknown): QuizQuestionDraft["options"] {
  if (!Array.isArray(value)) return [];
  return (value as StoredOption[]).map((option, index) => ({
    id: typeof option.id === "string" && option.id ? option.id : `option-${index}`,
    text: typeof option.text === "string" ? option.text : "",
    correct: option.correct === true,
  }));
}

export default async function LessonEditorPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  await requireStaff("products.manage");
  const { id, lessonId } = await params;

  const lesson = await db.lesson.findFirst({
    where: { id: lessonId, productId: id },
    include: {
      quiz: { include: { questions: { orderBy: { position: "asc" } } } },
      assets: { orderBy: { position: "asc" } },
    },
  });
  if (!lesson) notFound();

  const data: LessonEditorData = {
    id: lesson.id,
    type: lesson.type,
    title: lesson.title,
    isPublished: lesson.isPublished,
    isPreview: lesson.isPreview,
    durationSeconds: lesson.durationSeconds,
    content: lesson.content ?? "",
    videoProvider: lesson.videoProvider,
    videoUrl: lesson.videoUrl ?? "",
    embedUrl: lesson.embedUrl ?? "",
    quiz:
      lesson.type === "QUIZ"
        ? {
            passPercent: lesson.quiz?.passPercent ?? 70,
            maxAttempts: lesson.quiz?.maxAttempts ?? null,
            showAnswers: lesson.quiz?.showAnswers ?? true,
            questions: (lesson.quiz?.questions ?? []).map((question) => ({
              key: question.id,
              id: question.id,
              type: question.type === "SHORT" ? "SINGLE" : question.type,
              prompt: question.prompt,
              options: readOptions(question.options),
              explanation: question.explanation ?? "",
              points: question.points,
            })),
          }
        : null,
  };

  return (
    // Keyed by the saved version so the form starts from fresh values after every save elsewhere.
    <LessonEditor key={`${lesson.id}:${lesson.updatedAt.getTime()}`} productId={id} lesson={data}>
      <AssetManager
        compact
        productId={id}
        lessonId={lesson.id}
        title="Resources"
        description="Files, links and copyable snippets shown with this lesson."
        emptyTitle="No resources yet"
        emptyDescription="Attach worksheets, templates, starter files or reference links."
        assets={lesson.assets.map((asset) => ({
          id: asset.id,
          kind: asset.kind,
          title: asset.title,
          description: asset.description,
          version: asset.version,
          url: asset.url,
          fileKey: asset.fileKey,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
          content: asset.content,
          language: asset.language,
          downloadCount: asset.downloadCount,
        }))}
      />
    </LessonEditor>
  );
}
