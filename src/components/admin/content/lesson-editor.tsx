"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, CircleCheck, Trash2, Upload } from "lucide-react";
import type { LessonType, VideoProvider } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { LESSON_TYPE_LABELS } from "@/lib/labels";
import { detectVideoProvider, VIDEO_PROVIDER_LABELS, vimeoId, youtubeId } from "@/lib/video";
import { saveLesson } from "@/server/admin/content";
import { LESSON_ICONS } from "@/components/admin/content/curriculum-builder";
import { QuizBuilder, type QuizDraft } from "@/components/admin/content/quiz-builder";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { VideoPlayer } from "@/components/media/video-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { Callout } from "@/components/ui/misc";

export type LessonEditorData = {
  id: string;
  type: LessonType;
  title: string;
  isPublished: boolean;
  isPreview: boolean;
  durationSeconds: number | null;
  content: string;
  videoProvider: VideoProvider | null;
  videoUrl: string;
  embedUrl: string;
  quiz: QuizDraft | null;
};

type Draft = {
  title: string;
  isPublished: boolean;
  isPreview: boolean;
  durationMinutes: string;
  content: string;
  videoProvider: VideoProvider | null;
  videoUrl: string;
  embedUrl: string;
  quiz: QuizDraft | null;
};

function toDraft(lesson: LessonEditorData): Draft {
  return {
    title: lesson.title,
    isPublished: lesson.isPublished,
    isPreview: lesson.isPreview,
    durationMinutes: lesson.durationSeconds ? String(Math.round((lesson.durationSeconds / 60) * 10) / 10) : "",
    content: lesson.content,
    videoProvider: lesson.videoProvider,
    videoUrl: lesson.videoUrl,
    embedUrl: lesson.embedUrl,
    quiz: lesson.quiz,
  };
}

/** Whether the video source is complete enough to preview. */
function playable(provider: VideoProvider | null, url: string) {
  if (!provider || !url) return false;
  if (provider === "YOUTUBE") return !!youtubeId(url);
  if (provider === "VIMEO") return !!vimeoId(url);
  if (provider === "UPLOAD") return url.startsWith("/files/");
  return /^https?:\/\//.test(url) || url.startsWith("/");
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export function LessonEditor({
  productId,
  lesson,
  children,
}: {
  productId: string;
  lesson: LessonEditorData;
  /** Resources manager (saves on its own). */
  children?: React.ReactNode;
}) {
  const initial = useMemo(() => toDraft(lesson), [lesson]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== savedSnapshot;
  const Icon = LESSON_ICONS[lesson.type];

  const save = useAction(saveLesson, {
    success: "Lesson saved",
    onSuccess: () => setSavedSnapshot(JSON.stringify(draft)),
  });
  const errors = save.fieldErrors;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function submit() {
    const minutes = draft.durationMinutes.trim() === "" ? null : Number(draft.durationMinutes);
    save.run({
      productId,
      lessonId: lesson.id,
      title: draft.title,
      isPublished: draft.isPublished,
      isPreview: draft.isPreview,
      durationMinutes: minutes !== null && Number.isFinite(minutes) && minutes > 0 ? minutes : null,
      content: draft.content,
      videoProvider: draft.videoProvider,
      videoUrl: draft.videoUrl,
      embedUrl: draft.embedUrl,
      quiz: draft.quiz
        ? {
            passPercent: draft.quiz.passPercent,
            maxAttempts: draft.quiz.maxAttempts,
            showAnswers: draft.quiz.showAnswers,
            questions: draft.quiz.questions.map((question) => ({
              id: question.id,
              type: question.type,
              prompt: question.prompt,
              options: question.options,
              explanation: question.explanation,
              points: question.points,
            })),
          }
        : undefined,
    });
  }

  function setVideoLink(value: string) {
    const url = value.trim();
    setDraft((current) => ({ ...current, videoUrl: url, videoProvider: url ? (detectVideoProvider(url) ?? "URL") : null }));
  }

  const bodyLabel =
    lesson.type === "TEXT" ? "Article" : lesson.type === "QUIZ" ? "Introduction" : lesson.type === "DOWNLOAD" ? "Description" : "Notes under the lesson";

  return (
    <form
      className="pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Link
        href={`/admin/products/${productId}/curriculum`}
        className="mb-3 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to content
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge variant="primary">
          <Icon aria-hidden />
          {LESSON_TYPE_LABELS[lesson.type]} lesson
        </Badge>
        {draft.isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge>}
        {draft.isPreview ? <Badge variant="info">Free preview</Badge> : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
            <Field label="Lesson title" htmlFor="lesson-title" error={errors.title}>
              <Input
                id="lesson-title"
                value={draft.title}
                onChange={(event) => set("title", event.target.value)}
                className="h-11 text-base font-medium"
                required
              />
            </Field>
          </div>

          {lesson.type === "VIDEO" ? (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">Video</h2>
                <p className="text-sm text-muted-foreground">
                  Paste a link from YouTube, Vimeo, Bunny Stream or any direct video address — or upload a file.
                </p>
              </div>
              {draft.videoProvider === "UPLOAD" && draft.videoUrl ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-subtle/60 px-3 py-2.5">
                  <p className="flex min-w-0 items-center gap-2 text-sm">
                    <CircleCheck className="size-4 shrink-0 text-success" />
                    <span className="truncate">Uploaded video · only students with access can watch it</span>
                  </p>
                  <Button variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, videoUrl: "", videoProvider: null }))}>
                    <Trash2 /> Remove
                  </Button>
                </div>
              ) : (
                <Field
                  label="Video link"
                  htmlFor="video-url"
                  error={errors.videoUrl}
                  hint={
                    draft.videoProvider && draft.videoUrl
                      ? `Detected: ${VIDEO_PROVIDER_LABELS[draft.videoProvider]}`
                      : "Unlisted YouTube and private Vimeo links work well."
                  }
                >
                  <Input
                    id="video-url"
                    type="url"
                    inputMode="url"
                    value={draft.videoUrl}
                    onChange={(event) => setVideoLink(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    aria-invalid={!!errors.videoUrl}
                  />
                </Field>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <UploadButton
                  purpose="private"
                  accept="video/*"
                  size="sm"
                  onUploaded={(file) => setDraft((current) => ({ ...current, videoProvider: "UPLOAD", videoUrl: file.url }))}
                >
                  <Upload /> {draft.videoProvider === "UPLOAD" && draft.videoUrl ? "Replace video file" : "Upload a video file"}
                </UploadButton>
                <span className="text-xs text-muted-foreground">MP4 or WebM, up to 5 GB</span>
              </div>
              {playable(draft.videoProvider, draft.videoUrl) && draft.videoProvider ? (
                <div className="max-w-xl">
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
                  <VideoPlayer
                    key={`${draft.videoProvider}:${draft.videoUrl}`}
                    provider={draft.videoProvider}
                    url={draft.videoUrl}
                    title={draft.title}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {lesson.type === "EMBED" ? (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight">Embedded page</h2>
                <p className="text-sm text-muted-foreground">
                  Slides, a Notion page, a Figma file, a Loom, a form — anything that offers an embed link.
                </p>
              </div>
              <Field label="Embed address" htmlFor="embed-url" error={errors.embedUrl} hint="Must start with https:// and allow being embedded.">
                <Input
                  id="embed-url"
                  type="url"
                  inputMode="url"
                  value={draft.embedUrl}
                  onChange={(event) => set("embedUrl", event.target.value.trim())}
                  placeholder="https://"
                  aria-invalid={!!errors.embedUrl}
                />
              </Field>
            </div>
          ) : null}

          {lesson.type === "DOWNLOAD" ? (
            <Callout tone="info">
              Students see the description below followed by everything you add under <strong>Resources</strong>.
            </Callout>
          ) : null}

          <div className="grid gap-2">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">{bodyLabel}</h2>
              {lesson.type !== "TEXT" ? (
                <p className="text-sm text-muted-foreground">Optional. Shown to students with the lesson.</p>
              ) : null}
            </div>
            <RichTextEditor
              value={draft.content}
              onChange={(html) => set("content", html)}
              placeholder={lesson.type === "TEXT" ? "Write the lesson…" : "Add context, links or instructions…"}
              minHeight={lesson.type === "TEXT" ? 340 : 160}
            />
          </div>

          {lesson.type === "QUIZ" && draft.quiz ? <QuizBuilder value={draft.quiz} onChange={(quiz) => set("quiz", quiz)} /> : null}

          {children}
        </div>

        <aside className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5 lg:sticky lg:top-20">
          <h2 className="font-display text-base font-semibold tracking-tight">Lesson settings</h2>
          <ToggleRow
            label="Published"
            hint="Drafts are hidden from students."
            checked={draft.isPublished}
            onChange={(checked) => set("isPublished", checked)}
          />
          <ToggleRow
            label="Free preview"
            hint="Anyone can open this lesson without owning the product."
            checked={draft.isPreview}
            onChange={(checked) => set("isPreview", checked)}
          />
          <Field label="Length (minutes)" htmlFor="lesson-duration" optional hint="Shown next to the lesson so students can plan.">
            <Input
              id="lesson-duration"
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={draft.durationMinutes}
              onChange={(event) => set("durationMinutes", event.target.value)}
              placeholder="e.g. 12"
            />
          </Field>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-safe lg:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {save.error ? (
              <span className="font-medium text-danger-text">{save.error}</span>
            ) : dirty ? (
              "You have unsaved changes"
            ) : (
              "All changes saved"
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="secondary" className="hidden sm:inline-flex">
              <Link href={`/admin/products/${productId}/curriculum`}>Back</Link>
            </Button>
            <Button type="submit" loading={save.pending} disabled={!dirty && !save.error}>
              Save lesson
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
