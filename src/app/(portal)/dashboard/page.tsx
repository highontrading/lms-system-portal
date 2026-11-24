import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  Circle,
  CircleCheck,
  Compass,
  Flame,
  Library,
  Megaphone,
  Pin,
  Play,
  Sparkles,
} from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { OwnedProductCard } from "@/components/portal/dashboard/product-card";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { SectionHeading } from "@/components/ui/page-header";
import { cn, stripHtml, timeAgo, truncate } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getDashboardExtras, getLibrary } from "@/server/portal/dashboard";
import { getStreak } from "@/server/progress";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Home" };

function StatCard({
  icon,
  value,
  label,
  hint,
  tone = "primary",
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: "primary" | "spark" | "success";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary-text",
    spark: "bg-spark/20 text-warning-text",
    success: "bg-success-soft text-success-text",
  } as const;
  return (
    <Card className="flex items-center gap-3 p-3.5 sm:gap-3.5 sm:p-4">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl sm:size-11 [&_svg]:size-5", tones[tone])}>{icon}</span>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</p>
        <p className="mt-1 truncate text-[0.8125rem] text-muted-foreground">{label}</p>
        {hint ? <p className="hidden truncate text-xs text-muted-foreground/80 sm:block">{hint}</p> : null}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const [{ general, learning }, library] = await Promise.all([getSettings(), getLibrary(user.id)]);
  const { active } = library;

  const ownedIds = active.map((item) => item.productId);
  const [extras, streak] = await Promise.all([
    getDashboardExtras(user.id, ownedIds, ownedIds),
    learning.showStreak ? getStreak(user.id) : Promise.resolve(null),
  ]);

  const firstName = user.name.trim().split(/\s+/)[0] || "there";
  const now = new Date();

  // Resume the most recently used product that still has lessons left.
  const inProgress = active.filter((item) => item.totalLessons > 0 && !item.completedAt && item.progressPercent < 100);
  const resume =
    inProgress.find((item) => item.lastLessonId) ?? inProgress.find((item) => item.completedLessons > 0) ?? inProgress[0] ?? null;

  const checklist = [
    { label: "Add a profile photo", done: !!user.avatarUrl, href: "/account" },
    { label: "Open your first lesson", done: extras.hasOpenedLesson, href: resume ? `/learn/${resume.slug}` : "/library" },
    { label: "Complete a lesson", done: library.lessonsCompleted > 0, href: resume ? `/learn/${resume.slug}` : "/library" },
  ];
  const checklistDone = checklist.filter((item) => item.done).length;
  const showChecklist = active.length > 0 && checklistDone < checklist.length;

  return (
    <div className="grid gap-8">
      <header>
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl">
          Welcome back, {firstName} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          {active.length === 0
            ? "Your library is empty for now."
            : resume
              ? "Pick up right where you left off."
              : "Everything you own is ready in your library."}
        </p>
      </header>

      {active.length === 0 ? (
        <EmptyState
          icon={<Library />}
          title="Nothing here yet"
          description="It appears the moment your access is granted. Bought something? Make sure you signed in with the same email you used at checkout."
          action={
            <>
              <Button asChild>
                <Link href="/catalog">
                  <Compass /> Browse the catalog
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/account">Check my email address</Link>
              </Button>
            </>
          }
        />
      ) : null}

      {resume ? (
        <Card className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 120% at 100% 0%, color-mix(in oklab, var(--brand) 14%, transparent), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="relative grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:items-center md:gap-7 md:p-6">
            <Link href={`/learn/${resume.slug}`} className="block overflow-hidden rounded-lg" tabIndex={-1} aria-hidden>
              <ProductCover type={resume.type} thumbnailUrl={resume.thumbnailUrl} seed={resume.slug} title={resume.title} eager />
            </Link>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-primary-text uppercase">Continue learning</p>
              <h2 className="mt-1.5 font-display text-xl leading-snug font-semibold tracking-tight sm:text-2xl">
                <Link href={`/learn/${resume.slug}`} className="hover:text-primary-text">
                  {resume.title}
                </Link>
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Lesson {Math.min(resume.totalLessons, resume.completedLessons + 1)} of {resume.totalLessons}
                <span className="mx-1.5" aria-hidden>
                  ·
                </span>
                {resume.progressPercent}% complete
              </p>
              <ProgressBar value={resume.progressPercent} className="mt-4 max-w-md" label={`${resume.title} progress`} />
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link
                    href={resume.lastLessonId ? `/learn/${resume.slug}/lesson/${resume.lastLessonId}` : `/learn/${resume.slug}`}
                  >
                    <Play className="fill-current" />
                    {resume.completedLessons > 0 || resume.lastLessonId ? "Resume" : "Start learning"}
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                  <Link href={`/learn/${resume.slug}`}>View outline</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <section aria-label="Your numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<Library />} value={active.length} label="In your library" />
          <StatCard icon={<BookOpen />} value={library.lessonsCompleted} label={library.lessonsCompleted === 1 ? "Lesson done" : "Lessons done"} />
          <StatCard icon={<Award />} value={extras.certificates} label={extras.certificates === 1 ? "Certificate" : "Certificates"} tone="success" />
          {streak ? (
            <StatCard
              icon={<Flame />}
              value={streak.current}
              label="Day streak"
              hint={
                streak.current === 0
                  ? "Complete a lesson to start one"
                  : streak.activeToday
                    ? `Longest: ${streak.longest} ${streak.longest === 1 ? "day" : "days"}`
                    : "Learn today to keep it going"
              }
              tone="spark"
            />
          ) : (
            <StatCard icon={<Sparkles />} value={inProgress.length} label="In progress" />
          )}
        </section>
      ) : null}

      {active.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]">
          <section className="min-w-0">
            <SectionHeading
              title="Your library"
              action={
                <Link href="/library" className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {active.slice(0, 4).map((item) => (
                <OwnedProductCard key={item.enrollmentId} item={item} locale={general.locale} timeZone={general.timezone} now={now} />
              ))}
            </div>
          </section>

          <div className="grid min-w-0 content-start gap-6">
            {extras.sessions.length > 0 ? (
              <section>
                <SectionHeading
                  title={extras.sessions.length === 1 ? "Next live session" : "Upcoming live sessions"}
                  action={
                    <Link href="/live" className="text-sm font-medium text-primary-text hover:underline">
                      All sessions
                    </Link>
                  }
                />
                <div className="grid gap-3">
                  {extras.sessions.map((session) => {
                    const live = session.status === "LIVE" || (session.startsAt <= now && session.status === "SCHEDULED");
                    return (
                      <Link
                        key={session.id}
                        href="/live"
                        className="group flex gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border-strong"
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                          <CalendarClock className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {live ? (
                              <Badge variant="danger" size="sm">
                                <span className="size-1.5 animate-pulse-ring rounded-full bg-danger" aria-hidden />
                                Live now
                              </Badge>
                            ) : (
                              <Badge variant="primary" size="sm">
                                {timeAgo(session.startsAt, now)}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm leading-snug font-semibold group-hover:text-primary-text">{session.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{session.product.title}</p>
                          <p className="mt-1.5 text-[0.8125rem] font-medium">
                            <LocalTime date={session.startsAt} format="weekday-datetime" showZone fallbackZone={general.timezone} />
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {showChecklist ? (
              <section>
                <SectionHeading title="Getting started" description={`${checklistDone} of ${checklist.length} done`} />
                <Card className="p-2">
                  <ul>
                    {checklist.map((item) => (
                      <li key={item.label}>
                        {item.done ? (
                          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
                            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                            <span className="line-through decoration-muted-foreground/40">{item.label}</span>
                          </div>
                        ) : (
                          <Link
                            href={item.href}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
                          >
                            <Circle className="size-5 shrink-0 text-border-strong" aria-hidden />
                            <span className="flex-1">{item.label}</span>
                            <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ) : null}

            {extras.announcements.length > 0 ? (
              <section>
                <SectionHeading
                  title="Announcements"
                  action={
                    <Link href="/announcements" className="text-sm font-medium text-primary-text hover:underline">
                      See all
                    </Link>
                  }
                />
                <Card className="divide-y divide-border">
                  {extras.announcements.map((announcement) => (
                    <Link key={announcement.id} href="/announcements" className="group flex gap-3 p-4 transition-colors hover:bg-subtle">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        {announcement.isPinned ? <Pin className="size-4" aria-hidden /> : <Megaphone className="size-4" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm leading-snug font-semibold group-hover:text-primary-text">{announcement.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-muted-foreground">
                          {truncate(stripHtml(announcement.body).replace(/\s+([.,;:!?])/g, "$1"), 120)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {announcement.publishedAt ? timeAgo(announcement.publishedAt, now) : ""}
                          {announcement.product ? ` · ${announcement.product.title}` : ""}
                        </p>
                      </div>
                    </Link>
                  ))}
                </Card>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}

      {extras.recommended.length > 0 ? (
        <section>
          <SectionHeading
            title={active.length > 0 ? "You might also like" : "Popular right now"}
            action={
              <Link href="/catalog" className="inline-flex items-center gap-1 text-sm font-medium text-primary-text hover:underline">
                Browse catalog <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {extras.recommended.map((product) => (
              <Link
                key={product.id}
                href={`/catalog/${product.slug}`}
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
              >
                <ProductCover type={product.type} thumbnailUrl={product.thumbnailUrl} seed={product.slug} title={product.title} rounded={false} />
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <ProductTypeBadge type={product.type} size="sm" />
                  <h3 className="line-clamp-2 font-display text-[0.9375rem] leading-snug font-semibold tracking-tight group-hover:text-primary-text">
                    {product.title}
                  </h3>
                  {product.tagline ? <p className="line-clamp-2 text-[0.8125rem] text-muted-foreground">{product.tagline}</p> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
