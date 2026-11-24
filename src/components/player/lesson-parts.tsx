"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CircleCheck,
  CircleX,
  Clock,
  PartyPopper,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { QuestionType, VideoProvider } from "@/generated/prisma/enums";
import { cn, formatClock } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import {
  deleteNote,
  saveNote,
  saveProgress,
  setLessonComplete,
  submitQuiz,
} from "@/server/portal/learning-actions";
import { VideoPlayer } from "@/components/media/video-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Callout, ProgressRing } from "@/components/ui/misc";

// The video's last known position, so a note can be stamped with "where I was".
let latestVideoSeconds = 0;

/** Records that this lesson was opened, so "Resume" brings the learner back here. */
export function LessonTracker({ lessonId, enabled }: { lessonId: string; enabled: boolean }) {
  useEffect(() => {
    latestVideoSeconds = 0;
    if (enabled) void saveProgress({ lessonId, positionSeconds: null });
  }, [lessonId, enabled]);
  return null;
}

type Completion = { productCompleted: boolean; certificateSerial: string | null };

function CelebrationDialog({
  open,
  onOpenChange,
  productTitle,
  slug,
  certificateSerial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTitle: string;
  slug: string;
  certificateSerial: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader className="items-center pr-5 text-center sm:pr-6">
          <span className="mb-2 grid size-14 place-items-center rounded-full bg-spark text-spark-fg">
            <PartyPopper className="size-7" />
          </span>
          <DialogTitle className="text-xl">You did it!</DialogTitle>
          <DialogDescription>
            You&apos;ve completed <span className="font-medium text-foreground">{productTitle}</span>.
            {certificateSerial ? " Your certificate is ready." : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="hidden" />
        <DialogFooter className="mt-4">
          <Button asChild variant="secondary">
            <Link href={`/learn/${slug}`}>Back to overview</Link>
          </Button>
          {certificateSerial ? (
            <Button asChild>
              <Link href={`/certificates/${certificateSerial}`}>
                <Award /> View certificate
              </Link>
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Video ─────────────────────────────

export function LessonVideo({
  lessonId,
  provider,
  url,
  title,
  startAt,
  track,
  completed,
  productTitle,
  slug,
}: {
  lessonId: string;
  provider: VideoProvider;
  url: string;
  title: string;
  startAt: number;
  /** Save position and auto-complete (off for previews without access). */
  track: boolean;
  completed: boolean;
  productTitle: string;
  slug: string;
}) {
  const lastSaved = useRef(0);
  const finished = useRef(completed);
  const [celebration, setCelebration] = useState<Completion | null>(null);

  return (
    <>
      <VideoPlayer
        provider={provider}
        url={url}
        title={title}
        startAt={startAt}
        className="rounded-none sm:rounded-xl"
        onProgress={(seconds) => {
          latestVideoSeconds = seconds;
          if (!track) return;
          const now = Date.now();
          if (now - lastSaved.current < 8000) return;
          lastSaved.current = now;
          void saveProgress({ lessonId, positionSeconds: seconds });
        }}
        onEnded={async () => {
          if (!track || finished.current) return;
          finished.current = true;
          const result = await setLessonComplete({ lessonId, completed: true });
          if (result?.ok) {
            if (result.data.productCompleted) setCelebration(result.data);
            else toast.success("Lesson complete");
          } else {
            finished.current = false;
          }
        }}
      />
      <CelebrationDialog
        open={!!celebration}
        onOpenChange={(open) => !open && setCelebration(null)}
        productTitle={productTitle}
        slug={slug}
        certificateSerial={celebration?.certificateSerial ?? null}
      />
    </>
  );
}

// ───────────────────────────── Complete + navigation ─────────────────────────────

export function LessonControls({
  lessonId,
  completed,
  canComplete,
  manual,
  previousHref,
  nextHref,
  productTitle,
  slug,
}: {
  lessonId: string;
  completed: boolean;
  /** The viewer holds access (previews can be watched but not completed). */
  canComplete: boolean;
  /** Quizzes complete by passing, so they have no manual toggle. */
  manual: boolean;
  previousHref: string | null;
  nextHref: string | null;
  productTitle: string;
  slug: string;
}) {
  const [done, setDone] = useState(completed);
  const [syncedWith, setSyncedWith] = useState(completed);
  const [celebration, setCelebration] = useState<Completion | null>(null);
  // Follow the server's answer when it changes (e.g. a video finishing completes the lesson).
  if (syncedWith !== completed) {
    setSyncedWith(completed);
    setDone(completed);
  }

  const toggle = useAction(setLessonComplete, {
    onSuccess: (data) => {
      if (data.productCompleted) setCelebration(data);
    },
    onError: () => setDone(completed),
  });

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="order-2 flex gap-2 sm:order-1">
        {previousHref ? (
          <Button asChild variant="secondary" className="flex-1 sm:flex-none">
            <Link href={previousHref}>
              <ArrowLeft /> Previous
            </Link>
          </Button>
        ) : null}
        {nextHref ? (
          <Button asChild variant={done ? "primary" : "secondary"} className="flex-1 sm:flex-none">
            <Link href={nextHref}>
              Next lesson <ArrowRight />
            </Link>
          </Button>
        ) : null}
      </div>

      {canComplete && manual ? (
        <Button
          variant={done ? "soft" : "primary"}
          size="lg"
          className={cn("order-1 sm:order-2", done && "bg-success-soft text-success-text hover:bg-success-soft hover:brightness-97")}
          aria-pressed={done}
          disabled={toggle.pending}
          onClick={() => {
            const next = !done;
            setDone(next);
            void toggle.run({ lessonId, completed: next });
          }}
        >
          {done ? <CircleCheck /> : <Check />}
          {done ? "Completed" : "Mark as complete"}
        </Button>
      ) : canComplete && done ? (
        <span className="order-1 inline-flex items-center gap-2 text-sm font-medium text-success-text sm:order-2">
          <CircleCheck className="size-4.5" /> Completed
        </span>
      ) : null}

      <CelebrationDialog
        open={!!celebration}
        onOpenChange={(open) => !open && setCelebration(null)}
        productTitle={productTitle}
        slug={slug}
        certificateSerial={celebration?.certificateSerial ?? null}
      />
    </div>
  );
}

// ───────────────────────────── Notes ─────────────────────────────

export type LessonNote = { id: string; body: string; positionSeconds: number | null; createdAt: string };

export function NotesPanel({ lessonId, notes, isVideo, canWrite }: { lessonId: string; notes: LessonNote[]; isVideo: boolean; canWrite: boolean }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const save = useAction(saveNote, { success: "Note saved" });
  const remove = useAction(deleteNote, { success: "Note deleted" });

  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">Notes are available once you have access to this product.</p>;
  }

  return (
    <div className="grid gap-4">
      <form
        className="grid gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const stamp = isVideo && latestVideoSeconds > 3 ? Math.floor(latestVideoSeconds) : null;
          const result = await save.run({ lessonId, body: draft, positionSeconds: stamp });
          if (result.ok) setDraft("");
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a private note for this lesson…"
          rows={3}
          aria-label="New note"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Only you can see your notes.</p>
          <Button type="submit" size="sm" loading={save.pending} disabled={!draft.trim()}>
            Save note
          </Button>
        </div>
      </form>

      {notes.length === 0 ? null : (
        <ul className="grid gap-2.5">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border bg-card p-3.5">
              {editing?.id === note.id ? (
                <div className="grid gap-2">
                  <Textarea value={editing.body} onChange={(event) => setEditing({ id: note.id, body: event.target.value })} rows={3} aria-label="Edit note" />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      loading={save.pending}
                      disabled={!editing.body.trim()}
                      onClick={async () => {
                        const result = await save.run({ lessonId, noteId: note.id, body: editing.body });
                        if (result.ok) setEditing(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{note.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      {note.positionSeconds !== null ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary-text tabular-nums">
                          <Clock className="size-3" /> {formatClock(note.positionSeconds)}
                        </span>
                      ) : null}
                      <time dateTime={note.createdAt}>
                        {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(note.createdAt))}
                      </time>
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded hover:bg-muted hover:text-foreground"
                        aria-label="Edit note"
                        onClick={() => setEditing({ id: note.id, body: note.body })}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="grid size-7 place-items-center rounded hover:bg-danger-soft hover:text-danger-text"
                        aria-label="Delete note"
                        disabled={remove.pending}
                        onClick={() => void remove.run({ noteId: note.id })}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── Quiz ─────────────────────────────

export type QuizQuestionView = {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: { id: string; text: string }[];
};

type QuizResult = {
  percent: number;
  passed: boolean;
  score: number;
  maxScore: number;
  passPercent: number;
  attemptsLeft: number | null;
  showAnswers: boolean;
  review: { questionId: string; correct: boolean; correctOptionIds?: string[]; explanation?: string | null }[];
  productCompleted: boolean;
  certificateSerial: string | null;
};

export function QuizRunner({
  lessonId,
  questions,
  passPercent,
  maxAttempts,
  attemptsUsed,
  best,
  canTake,
  nextHref,
  productTitle,
  slug,
}: {
  lessonId: string;
  questions: QuizQuestionView[];
  passPercent: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  best: { percent: number; passed: boolean } | null;
  canTake: boolean;
  nextHref: string | null;
  productTitle: string;
  slug: string;
}) {
  const [phase, setPhase] = useState<"intro" | "taking" | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const submit = useAction(submitQuiz, {
    onSuccess: (data) => {
      setResult(data as QuizResult);
      setPhase("result");
      if (data.productCompleted) setCelebrate(true);
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  });

  const attemptsLeft = result ? result.attemptsLeft : maxAttempts ? Math.max(0, maxAttempts - attemptsUsed) : null;
  const outOfAttempts = attemptsLeft !== null && attemptsLeft <= 0;
  const answered = questions.filter((question) => (answers[question.id] ?? []).some((value) => value.trim() !== "")).length;

  function choose(question: QuizQuestionView, optionId: string) {
    setAnswers((current) => {
      if (question.type === "MULTIPLE") {
        const set = new Set(current[question.id] ?? []);
        if (set.has(optionId)) set.delete(optionId);
        else set.add(optionId);
        return { ...current, [question.id]: [...set] };
      }
      return { ...current, [question.id]: [optionId] };
    });
  }

  if (questions.length === 0) {
    return <Callout tone="neutral">This quiz doesn&apos;t have any questions yet.</Callout>;
  }

  if (phase === "intro") {
    return (
      <div ref={topRef} className="rounded-xl border border-border bg-card p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Questions", String(questions.length)],
            ["Pass mark", `${passPercent}%`],
            ["Attempts", maxAttempts ? `${Math.max(0, maxAttempts - attemptsUsed)} of ${maxAttempts} left` : "Unlimited"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-subtle px-4 py-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-0.5 font-display text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
        {best ? (
          <Callout tone={best.passed ? "success" : "neutral"} className="mt-4" icon={best.passed ? <CircleCheck /> : undefined}>
            {best.passed ? `You passed with ${best.percent}%.` : `Your best score so far is ${best.percent}%.`}
          </Callout>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {canTake && !outOfAttempts ? (
            <Button size="lg" onClick={() => setPhase("taking")}>
              {best ? "Take it again" : "Start quiz"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canTake ? "You've used all your attempts for this quiz." : "Get access to this product to take the quiz."}
            </p>
          )}
          {best?.passed && nextHref ? (
            <Button asChild variant="secondary" size="lg">
              <Link href={nextHref}>
                Next lesson <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const reviewById = new Map(result?.review.map((item) => [item.questionId, item]));

  return (
    <div ref={topRef} className="grid scroll-mt-20 gap-4">
      {phase === "result" && result ? (
        <div className={cn("flex flex-col items-center gap-4 rounded-xl border p-6 text-center sm:flex-row sm:text-left", result.passed ? "border-success/30 bg-success-soft" : "border-border bg-card")}>
          <ProgressRing value={result.percent} size={84} stroke={8} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold">{result.passed ? "You passed 🎉" : "Not quite there yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You scored {result.score} of {result.maxScore} ({result.percent}%). The pass mark is {result.passPercent}%.
              {!result.passed && result.attemptsLeft !== null ? ` ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-2">
            {!result.passed && !outOfAttempts ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setAnswers({});
                  setResult(null);
                  setPhase("taking");
                }}
              >
                <RefreshCw /> Try again
              </Button>
            ) : null}
            {result.passed && nextHref ? (
              <Button asChild>
                <Link href={nextHref}>
                  Next lesson <ArrowRight />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {questions.map((question, index) => {
        const review = reviewById.get(question.id);
        const selected = answers[question.id] ?? [];
        const locked = phase === "result";
        return (
          <fieldset key={question.id} className="rounded-xl border border-border bg-card p-4 sm:p-5" disabled={locked}>
            <legend className="sr-only">Question {index + 1}</legend>
            <div className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text tabular-nums">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] leading-relaxed font-medium whitespace-pre-wrap">{question.prompt}</p>
                {question.type === "MULTIPLE" ? <p className="mt-0.5 text-xs text-muted-foreground">Select all that apply</p> : null}
              </div>
              {review ? (
                review.correct ? (
                  <CircleCheck className="size-5 shrink-0 text-success" aria-label="Correct" />
                ) : (
                  <CircleX className="size-5 shrink-0 text-danger" aria-label="Incorrect" />
                )
              ) : null}
            </div>

            {question.type === "SHORT" ? (
              <input
                type="text"
                value={selected[0] ?? ""}
                onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: [event.target.value] }))}
                placeholder="Type your answer"
                aria-label={`Answer to question ${index + 1}`}
                className="mt-3.5 ml-10 h-10 w-[calc(100%-2.5rem)] rounded-md border border-input bg-card px-3 text-sm focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
              />
            ) : (
              <div className="mt-3.5 grid gap-2 sm:ml-10">
                {question.options.map((option) => {
                  const isSelected = selected.includes(option.id);
                  const isCorrect = review?.correctOptionIds?.includes(option.id);
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 text-sm transition-colors",
                        isSelected ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                        locked && "cursor-default",
                        locked && isCorrect && "border-success bg-success-soft",
                        locked && isSelected && review && !review.correct && !isCorrect && "border-danger bg-danger-soft",
                      )}
                    >
                      <input
                        type={question.type === "MULTIPLE" ? "checkbox" : "radio"}
                        name={`question-${question.id}`}
                        checked={isSelected}
                        onChange={() => choose(question, option.id)}
                        className="mt-0.5 size-4 shrink-0 accent-(--brand)"
                      />
                      <span className="min-w-0 flex-1 leading-relaxed">{option.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {review?.explanation ? (
              <p className="mt-3 rounded-lg bg-subtle px-3.5 py-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground sm:ml-10">
                <span className="font-medium text-foreground">Why: </span>
                {review.explanation}
              </p>
            ) : null}
          </fieldset>
        );
      })}

      {phase === "taking" ? (
        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm text-muted-foreground tabular-nums">
            {answered} of {questions.length} answered
          </p>
          <Button loading={submit.pending} disabled={answered < questions.length} onClick={() => void submit.run({ lessonId, answers })}>
            Submit answers
          </Button>
        </div>
      ) : null}

      <CelebrationDialog
        open={celebrate}
        onOpenChange={setCelebrate}
        productTitle={productTitle}
        slug={slug}
        certificateSerial={result?.certificateSerial ?? null}
      />
    </div>
  );
}
