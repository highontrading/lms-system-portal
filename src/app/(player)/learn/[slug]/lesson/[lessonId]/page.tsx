import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye, Lock, Paperclip, NotebookPen } from "lucide-react";
import { LESSON_TYPE_LABELS } from "@/lib/labels";
import { formatDuration } from "@/lib/utils";
import { RichText } from "@/components/content";
import { AssetList } from "@/components/portal/learn/asset-list";
import { LESSON_TYPE_ICONS, lockMessage } from "@/components/portal/learn/lesson-meta";
import {
  LessonControls,
  LessonTracker,
  LessonVideo,
  NotesPanel,
  QuizRunner,
  type QuizQuestionView,
} from "@/components/player/lesson-parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/interactive";
import { Callout } from "@/components/ui/misc";
import { requireUser } from "@/server/auth/guards";
import { getLearningContext, getLessonDetail, parseQuizOptions } from "@/server/portal/learning";
import { getSettings } from "@/server/settings";

type Props = { params: Promise<{ slug: string; lessonId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug, lessonId }, { user }] = await Promise.all([params, requireUser()]);
  const ctx = await getLearningContext(slug, user);
  const lesson = ctx?.lessons.find((item) => item.id === lessonId);
  return { title: lesson ? `${lesson.title} · ${ctx!.product.title}` : "Lesson", robots: { index: false } };
}

function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default async function LessonPage({ params }: Props) {
  const [{ slug, lessonId }, { user }, { general }] = await Promise.all([params, requireUser(), getSettings()]);
  const ctx = await getLearningContext(slug, user);
  if (!ctx) notFound();

  const index = ctx.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) notFound();
  const summary = ctx.lessons[index];
  const lock = ctx.locks[lessonId] ?? { locked: false };
  const Icon = LESSON_TYPE_ICONS[summary.type];

  // Previous / next skip over lessons the viewer can't open yet.
  const openLessons = ctx.lessons.filter((lesson) => !ctx.locks[lesson.id]?.locked);
  const openIndex = openLessons.findIndex((lesson) => lesson.id === lessonId);
  const previous = openIndex > 0 ? openLessons[openIndex - 1] : null;
  const next = openIndex >= 0 && openIndex < openLessons.length - 1 ? openLessons[openIndex + 1] : null;
  const href = (id: string) => `/learn/${slug}/lesson/${id}`;

  if (lock.locked) {
    return (
      <div className="mx-auto grid w-full max-w-xl place-items-center px-4 py-16 text-center sm:py-24">
        <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">{summary.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lock.reason === "enroll"
            ? "This lesson is part of the full program. Get access to open it."
            : `${lockMessage(lock, general.locale)}.`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/learn/${slug}`}>
              <ArrowLeft /> Back to overview
            </Link>
          </Button>
          {lock.reason === "enroll" ? (
            <Button asChild>
              <Link href={`/catalog/${slug}`}>See how to get access</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const detail = await getLessonDetail(ctx.product.id, lessonId, user.id);
  if (!detail) notFound();
  const { lesson, notes, attempts } = detail;
  const completed = ctx.completedLessonIds.has(lessonId);
  const isVideo = lesson.type === "VIDEO" && !!lesson.videoProvider && !!lesson.videoUrl;
  const embedUrl = lesson.type === "EMBED" && lesson.embedUrl && /^https:\/\//i.test(lesson.embedUrl) ? lesson.embedUrl : null;

  let quizQuestions: QuizQuestionView[] = [];
  if (lesson.type === "QUIZ" && lesson.quiz) {
    const mapped = lesson.quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points,
      // The answer key stays on the server until the attempt has been graded.
      options: question.type === "SHORT" ? [] : parseQuizOptions(question.options).map((option) => ({ id: option.id, text: option.text })),
    }));
    quizQuestions = lesson.quiz.shuffleQuestions ? shuffled(mapped) : mapped;
  }
  const bestAttempt = attempts.length > 0 ? attempts.reduce((best, attempt) => (attempt.percent > best.percent ? attempt : best)) : null;

  const header = (
    <header className={isVideo ? "mt-5" : ""}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium">{summary.sectionTitle}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Icon className="size-3.5" /> {LESSON_TYPE_LABELS[lesson.type]}
        </span>
        {lesson.durationSeconds ? (
          <>
            <span aria-hidden>·</span>
            <span>{formatDuration(lesson.durationSeconds)}</span>
          </>
        ) : null}
        {!ctx.hasAccess && lesson.isPreview ? (
          <Badge variant="spark" size="sm">
            <Eye /> Free preview
          </Badge>
        ) : null}
      </div>
      <h1 className="mt-1.5 font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">{lesson.title}</h1>
    </header>
  );

  return (
    <article className="mx-auto w-full max-w-4xl pb-16 sm:px-6 sm:pt-6">
      <LessonTracker lessonId={lesson.id} enabled={ctx.hasAccess} />

      {isVideo ? (
        <LessonVideo
          lessonId={lesson.id}
          provider={lesson.videoProvider!}
          url={lesson.videoUrl!}
          title={lesson.title}
          startAt={completed ? 0 : (ctx.positions[lesson.id] ?? 0)}
          track={ctx.hasAccess}
          completed={completed}
          productTitle={ctx.product.title}
          slug={slug}
        />
      ) : null}

      <div className="px-4 pt-5 sm:px-0 sm:pt-0">
        {header}

        {lesson.type === "VIDEO" && !isVideo ? (
          <Callout tone="neutral" className="mt-5">The video for this lesson hasn&apos;t been added yet.</Callout>
        ) : null}

        {embedUrl ? (
          <div className="relative mt-5 aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
            <iframe
              src={embedUrl}
              title={lesson.title}
              className="absolute inset-0 size-full border-0"
              loading="lazy"
              allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : lesson.type === "EMBED" ? (
          <Callout tone="neutral" className="mt-5">This embed isn&apos;t available.</Callout>
        ) : null}

        {lesson.content ? (
          <div className={lesson.type === "TEXT" ? "mt-6 max-w-[42rem]" : "mt-5 max-w-[46rem]"}>
            <RichText html={lesson.content} />
          </div>
        ) : null}

        {lesson.type === "ASSIGNMENT" ? (
          <Callout tone="info" className="mt-5">
            Submissions aren&apos;t available yet. Work through the brief above, then mark this lesson as complete.
          </Callout>
        ) : null}

        {lesson.type === "DOWNLOAD" && lesson.assets.length > 0 ? (
          <div className="mt-6">
            <AssetList assets={lesson.assets} />
          </div>
        ) : null}

        {lesson.type === "QUIZ" && lesson.quiz ? (
          <div className="mt-6">
            <QuizRunner
              key={lesson.id}
              lessonId={lesson.id}
              questions={quizQuestions}
              passPercent={lesson.quiz.passPercent}
              maxAttempts={lesson.quiz.maxAttempts}
              attemptsUsed={attempts.length}
              best={bestAttempt ? { percent: bestAttempt.percent, passed: attempts.some((attempt) => attempt.passed) } : null}
              canTake={ctx.hasAccess}
              nextHref={next ? href(next.id) : null}
              productTitle={ctx.product.title}
              slug={slug}
            />
          </div>
        ) : null}

        <LessonControls
          key={lesson.id}
          lessonId={lesson.id}
          completed={completed}
          canComplete={ctx.hasAccess}
          manual={lesson.type !== "QUIZ"}
          previousHref={previous ? href(previous.id) : null}
          nextHref={next ? href(next.id) : null}
          productTitle={ctx.product.title}
          slug={slug}
        />

        <Tabs defaultValue={lesson.type !== "DOWNLOAD" && lesson.assets.length > 0 ? "resources" : "notes"} className="mt-8">
          <TabsList>
            {lesson.type !== "DOWNLOAD" ? (
              <TabsTrigger value="resources">
                <Paperclip /> Resources
                {lesson.assets.length > 0 ? <span className="text-xs text-muted-foreground">({lesson.assets.length})</span> : null}
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="notes">
              <NotebookPen /> My notes
              {notes.length > 0 ? <span className="text-xs text-muted-foreground">({notes.length})</span> : null}
            </TabsTrigger>
          </TabsList>
          {lesson.type !== "DOWNLOAD" ? (
            <TabsContent value="resources">
              {lesson.assets.length > 0 ? (
                <AssetList assets={lesson.assets} />
              ) : (
                <p className="text-sm text-muted-foreground">There are no extra resources for this lesson.</p>
              )}
            </TabsContent>
          ) : null}
          <TabsContent value="notes">
            <NotesPanel
              key={lesson.id}
              lessonId={lesson.id}
              isVideo={isVideo}
              canWrite={ctx.hasAccess}
              notes={notes.map((note) => ({
                id: note.id,
                body: note.body,
                positionSeconds: note.positionSeconds,
                createdAt: note.createdAt.toISOString(),
              }))}
            />
          </TabsContent>
        </Tabs>
      </div>
    </article>
  );
}
