"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleCheck, ListVideo, Lock, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import type { ThemeChoice } from "@/lib/theme";
import { cn, formatDuration } from "@/lib/utils";
import { LESSON_TYPE_ICONS, lockMessage, type LockState } from "@/components/portal/learn/lesson-meta";
import { ThemeToggle } from "@/components/theme/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/misc";

export type PlayerLesson = {
  id: string;
  title: string;
  type: LessonType;
  durationSeconds: number | null;
  completed: boolean;
  lock: LockState;
};

export type PlayerSection = { id: string; title: string; lessons: PlayerLesson[] };

function CurriculumList({
  slug,
  sections,
  activeId,
  onNavigate,
}: {
  slug: string;
  sections: PlayerSection[];
  activeId?: string;
  /** Called when a lesson is picked (the phone drawer uses it to close itself). */
  onNavigate?: () => void;
}) {
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  return (
    <nav aria-label="Lessons" className="pb-6">
      {sections.map((section, sectionIndex) => {
        const done = section.lessons.filter((lesson) => lesson.completed).length;
        return (
          <div key={section.id}>
            <div className="sticky top-0 z-10 flex items-baseline justify-between gap-3 border-b border-border bg-subtle px-4 py-2.5">
              <p className="min-w-0 truncate text-[0.8125rem] font-semibold">
                <span className="mr-1.5 text-muted-foreground tabular-nums">{sectionIndex + 1}.</span>
                {section.title}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {done}/{section.lessons.length}
              </span>
            </div>
            <ul>
              {section.lessons.map((lesson) => {
                const Icon = LESSON_TYPE_ICONS[lesson.type];
                const active = lesson.id === activeId;
                const locked = lesson.lock.locked;
                const meta = locked ? lockMessage(lesson.lock) : formatDuration(lesson.durationSeconds);
                const body = (
                  <>
                    <span className="mt-0.5 shrink-0">
                      {lesson.completed ? (
                        <CircleCheck className="size-4.5 text-success" aria-label="Completed" />
                      ) : locked ? (
                        <Lock className="size-4.5 text-muted-foreground/70" aria-label="Locked" />
                      ) : (
                        <Icon className={cn("size-4.5", active ? "text-primary-text" : "text-muted-foreground")} aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm leading-snug", active && "font-semibold", locked && "text-muted-foreground")}>
                        {lesson.title}
                      </span>
                      {meta ? <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span> : null}
                    </span>
                  </>
                );
                return (
                  <li key={lesson.id}>
                    {locked ? (
                      <div className="flex gap-3 px-4 py-2.5" aria-disabled>
                        {body}
                      </div>
                    ) : (
                      <Link
                        ref={active ? activeRef : undefined}
                        href={`/learn/${slug}/lesson/${lesson.id}`}
                        aria-current={active ? "page" : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "flex gap-3 border-l-2 border-transparent px-4 py-2.5 transition-colors hover:bg-muted",
                          active && "border-primary bg-primary-soft hover:bg-primary-soft",
                        )}
                      >
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Distraction-free frame around a lesson: slim header, the lesson, and the course outline. */
export function PlayerShell({
  slug,
  title,
  percent,
  completedCount,
  totalLessons,
  showProgress,
  defaultTheme,
  sections,
  children,
}: {
  slug: string;
  title: string;
  percent: number;
  completedCount: number;
  totalLessons: number;
  showProgress: boolean;
  defaultTheme: ThemeChoice;
  sections: PlayerSection[];
  children: React.ReactNode;
}) {
  const params = useParams<{ lessonId?: string }>();
  const activeId = params.lessonId;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);


  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-card/92 px-2.5 backdrop-blur-md sm:gap-3 sm:px-4">
        <Link
          href={`/learn/${slug}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Overview</span>
        </Link>
        <div className="h-6 w-px shrink-0 bg-border" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm leading-tight font-semibold">{title}</p>
          {showProgress && totalLessons > 0 ? (
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar value={percent} size="sm" className="max-w-36" label="Overall progress" />
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                {completedCount}/{totalLessons} · {percent}%
              </span>
            </div>
          ) : null}
        </div>
        <ThemeToggle defaultTheme={defaultTheme} />
        <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
          <ListVideo />
          Lessons
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden lg:inline-flex"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={sidebarOpen ? "Hide lesson list" : "Show lesson list"}
        >
          {sidebarOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </header>

      <div className="flex flex-1">
        <main className="min-w-0 flex-1">{children}</main>
        {sidebarOpen ? (
          <aside className="hidden w-[21rem] shrink-0 border-l border-border bg-card lg:block xl:w-[23rem]">
            <div className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto">
              <CurriculumList slug={slug} sections={sections} activeId={activeId} />
            </div>
          </aside>
        ) : null}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" title="Lessons" className="max-w-md">
          <div className="mt-3 flex-1 overflow-y-auto border-t border-border">
            <CurriculumList slug={slug} sections={sections} activeId={activeId} onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
