import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Award,
  CalendarClock,
  CircleCheck,
  Clock,
  FolderOpen,
  History,
  KeyRound,
  Layers,
  ListVideo,
  Lock,
  Play,
  RotateCcw,
} from "lucide-react";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { cn, firstParam, formatDate, formatDuration, pluralize, type SearchParams } from "@/lib/utils";
import { RichText } from "@/components/content";
import { AssetList } from "@/components/portal/learn/asset-list";
import { LESSON_TYPE_ICONS, lockMessage } from "@/components/portal/learn/lesson-meta";
import { SessionCard, sessionPhase } from "@/components/portal/learn/session-card";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/controls";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/interactive";
import { Callout, EmptyState, ProgressBar, ProgressRing } from "@/components/ui/misc";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getLearningContext } from "@/server/portal/learning";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParams };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, { user }] = await Promise.all([params, requireUser()]);
  const ctx = await getLearningContext(slug, user);
  return { title: ctx?.product.title ?? "Not found", robots: { index: false } };
}

export default async function ProductHomePage({ params, searchParams }: Props) {
  const [{ slug }, query, { user }, { general }] = await Promise.all([params, searchParams, requireUser(), getSettings()]);
  const ctx = await getLearningContext(slug, user);
  if (!ctx) notFound();
  const { product, enrollment } = ctx;
  const dateOptions = { locale: general.locale, timeZone: general.timezone } as const;

  if (!ctx.hasAccess) {
    return (
      <div className="mx-auto max-w-xl py-6 sm:py-12">
        <ProductCover type={product.type} thumbnailUrl={product.thumbnailUrl} seed={product.slug} title={product.title} className="mx-auto max-w-sm" />
        <div className="mt-6 text-center">
          <span className="inline-grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-5" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">{product.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {ctx.lapsed
              ? enrollment?.status === "REVOKED"
                ? "Your access to this has been removed. If you think that's a mistake, please contact support."
                : `Your access ended on ${enrollment?.expiresAt ? formatDate(enrollment.expiresAt, { ...dateOptions, style: "long" }) : "an earlier date"}.`
              : "You don't have access to this yet. Once you've purchased it with this email address, it appears here automatically."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link href={`/catalog/${product.slug}`}>See how to get access</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/library">Back to my library</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const guideLabel = product.type === "AGENT" || product.type === "WORKFLOW" || product.type === "DIGITAL" ? "Setup guide" : "Content";
  const productAssets = product.assets.filter((asset) => !asset.lessonId);
  const lessonAssets = product.assets.filter(
    (asset) => asset.lesson?.isPublished && asset.lessonId && !ctx.locks[asset.lessonId]?.locked,
  );
  const sessions = product.liveSessions;
  const upcomingSessions = sessions.filter((session) => ["upcoming", "live"].includes(sessionPhase(session, now)));
  const pastSessions = sessions.filter((session) => !["upcoming", "live"].includes(sessionPhase(session, now))).reverse();
  const bundleItems = product.bundleItems.filter((item) => item.product.status !== "DRAFT" || ctx.staff);

  const tabs = [
    ctx.totalLessons > 0 ? { id: "content", label: guideLabel, icon: ListVideo, count: ctx.totalLessons } : null,
    bundleItems.length > 0 ? { id: "included", label: "What's included", icon: Layers, count: bundleItems.length } : null,
    sessions.length > 0 ? { id: "live", label: "Live sessions", icon: CalendarClock, count: upcomingSessions.length || undefined } : null,
    productAssets.length + lessonAssets.length > 0
      ? { id: "files", label: "Files & links", icon: FolderOpen, count: productAssets.length + lessonAssets.length }
      : null,
    product.updates.length > 0 ? { id: "updates", label: "Updates", icon: History, count: undefined } : null,
  ].filter((tab) => tab !== null);

  const preferred = product.type === "WORKSHOP" && sessions.length > 0 ? "live" : tabs[0]?.id;
  const requested = firstParam(query.tab);
  const activeTab = tabs.some((tab) => tab.id === requested) ? requested : preferred;

  const bundleProgress =
    bundleItems.length > 0
      ? new Map(
          (
            await db.enrollment.findMany({
              where: { userId: user.id, productId: { in: bundleItems.map((item) => item.productId) } },
              select: { productId: true, progressPercent: true },
            })
          ).map((row) => [row.productId, row.progressPercent]),
        )
      : new Map<string, number>();

  const totalSeconds = ctx.lessons.reduce((sum, lesson) => sum + (lesson.durationSeconds ?? 0), 0);
  const resume = ctx.resumeLesson;
  const started = ctx.completedCount > 0 || !!enrollment?.lastLessonId;
  const allDone = ctx.totalLessons > 0 && ctx.completedCount >= ctx.totalLessons;
  const nextSession = upcomingSessions[0];
  const openSectionId =
    ctx.sections.find((section) => section.lessons.some((lesson) => lesson.id === resume?.id))?.id ?? ctx.sections[0]?.id;

  return (
    <div className="mx-auto max-w-5xl">
      {/* ── Header ── */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="grid gap-5 p-4 sm:p-6 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-7">
          <ProductCover type={product.type} thumbnailUrl={product.thumbnailUrl} seed={product.slug} title={product.title} eager />
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <ProductTypeBadge type={product.type} />
              {product.version ? <Badge variant="outline">v{product.version}</Badge> : null}
              {product.platform ? <Badge>{product.platform}</Badge> : null}
              {ctx.staff && !ctx.active ? <Badge variant="warning">Staff preview</Badge> : null}
              {product.status !== "PUBLISHED" ? <Badge variant="warning">{product.status === "DRAFT" ? "Draft" : "Archived"}</Badge> : null}
            </div>
            <h1 className="mt-2.5 font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">{product.title}</h1>
            {product.tagline ? <p className="mt-1.5 text-sm text-muted-foreground">{product.tagline}</p> : null}

            {ctx.totalLessons > 0 ? (
              <div className="mt-4 flex items-center gap-4">
                <ProgressRing value={ctx.percent} size={60} stroke={6} />
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {allDone ? "All lessons complete" : `${ctx.completedCount} of ${pluralize(ctx.totalLessons, "lesson")} complete`}
                  </p>
                  <p className="text-muted-foreground">
                    {totalSeconds > 0 ? `${formatDuration(totalSeconds)} of content` : PRODUCT_TYPE_LABELS[product.type]}
                    {enrollment?.completedAt ? ` · Completed ${formatDate(enrollment.completedAt, dateOptions)}` : ""}
                  </p>
                </div>
              </div>
            ) : nextSession ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="size-4 text-primary-text" /> Next session: <span className="font-medium text-foreground">{nextSession.title}</span>
              </p>
            ) : null}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              {resume ? (
                <Button asChild size="lg">
                  <Link href={`/learn/${product.slug}/lesson/${resume.id}`}>
                    {allDone ? <RotateCcw /> : <Play className="fill-current" />}
                    {allDone ? "Review lessons" : started ? "Resume" : guideLabel === "Setup guide" ? "Start setup" : "Start learning"}
                  </Link>
                </Button>
              ) : null}
              {product.type === "WORKSHOP" && sessions.length > 0 && activeTab !== "live" ? (
                <Button asChild size="lg" variant={resume ? "secondary" : "primary"}>
                  <Link href={`/learn/${product.slug}?tab=live`}>
                    <CalendarClock /> Live sessions
                  </Link>
                </Button>
              ) : null}
              {ctx.certificate ? (
                <Button asChild size="lg" variant="spark">
                  <Link href={`/certificates/${ctx.certificate.serial}`}>
                    <Award /> View certificate
                  </Link>
                </Button>
              ) : null}
            </div>
            {resume && !allDone && started ? (
              <p className="mt-2 truncate text-xs text-muted-foreground">Up next: {resume.title}</p>
            ) : null}
          </div>
        </div>

        {enrollment?.licenseKey || enrollment?.expiresAt || (product.certificateEnabled && !ctx.certificate && ctx.totalLessons > 0) ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border bg-subtle/70 px-4 py-3 text-[0.8125rem] sm:px-6">
            {enrollment?.licenseKey ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Licence key</span>
                <code className="rounded bg-card px-2 py-0.5 font-mono text-xs ring-1 ring-border">{enrollment.licenseKey}</code>
                <CopyButton value={enrollment.licenseKey} iconOnly size="xs" variant="ghost" label="Copy licence key" toastMessage="Licence key copied" />
              </span>
            ) : null}
            {enrollment?.expiresAt ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" /> Access until{" "}
                <span className="font-medium text-foreground">{formatDate(enrollment.expiresAt, { ...dateOptions, style: "long" })}</span>
              </span>
            ) : null}
            {product.certificateEnabled && !ctx.certificate && ctx.totalLessons > 0 ? (
              <span className="inline-flex items-start gap-2 text-muted-foreground">
                <Award className="mt-0.5 size-4 shrink-0" />
                <span>
                  Complete {product.completionPercent}% to earn your certificate{" "}
                  <span className="font-medium whitespace-nowrap text-foreground tabular-nums">({ctx.percent}% so far)</span>
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ── Tabs ── */}
      {tabs.length > 1 ? (
        <nav aria-label="Sections" className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/learn/${product.slug}?tab=${tab.id}`}
              scroll={false}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                activeTab === tab.id && "border-primary text-foreground",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
              {tab.count ? <span className="rounded-full bg-muted px-1.5 text-[0.6875rem] tabular-nums">{tab.count}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="mt-6">
        {tabs.length === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title="Content is on its way"
            description="Nothing has been added to this product yet. You'll get a notification as soon as something is published."
          />
        ) : null}

        {activeTab === "content" ? (
          <Accordion type="multiple" defaultValue={openSectionId ? [openSectionId] : []} className="overflow-hidden rounded-xl border border-border bg-card">
            {ctx.sections.map((section, sectionIndex) => {
              const done = section.lessons.filter((lesson) => ctx.completedLessonIds.has(lesson.id)).length;
              const seconds = section.lessons.reduce((sum, lesson) => sum + (lesson.durationSeconds ?? 0), 0);
              const sectionLock = section.lessons.every((lesson) => ctx.locks[lesson.id]?.locked) ? ctx.locks[section.lessons[0].id] : null;
              return (
                <AccordionItem key={section.id} value={section.id}>
                  <AccordionTrigger className="px-4 sm:px-5">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums",
                          done === section.lessons.length ? "bg-success-soft text-success-text" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {done === section.lessons.length ? <CircleCheck className="size-4.5" /> : sectionIndex + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{section.title}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {sectionLock
                            ? lockMessage(sectionLock, general.locale)
                            : `${done}/${section.lessons.length} done${seconds > 0 ? ` · ${formatDuration(seconds)}` : ""}`}
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    {section.description ? <p className="px-4 pb-2 sm:px-5">{section.description}</p> : null}
                    <ul>
                      {section.lessons.map((lesson) => {
                        const Icon = LESSON_TYPE_ICONS[lesson.type];
                        const lock = ctx.locks[lesson.id];
                        const completed = ctx.completedLessonIds.has(lesson.id);
                        const isResume = lesson.id === resume?.id && !allDone;
                        const row = (
                          <>
                            <span className="shrink-0">
                              {completed ? (
                                <CircleCheck className="size-5 text-success" aria-label="Completed" />
                              ) : lock?.locked ? (
                                <Lock className="size-5 text-muted-foreground/60" aria-label="Locked" />
                              ) : (
                                <Icon className="size-5 text-muted-foreground" aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={cn("block text-sm text-foreground", lock?.locked && "text-muted-foreground")}>{lesson.title}</span>
                              {lock?.locked ? <span className="block text-xs">{lockMessage(lock, general.locale)}</span> : null}
                            </span>
                            {isResume ? <Badge variant="primary" size="sm">{started ? "Resume" : "Start"}</Badge> : null}
                            {lesson.durationSeconds ? (
                              <span className="shrink-0 text-xs tabular-nums">{formatDuration(lesson.durationSeconds)}</span>
                            ) : null}
                          </>
                        );
                        return (
                          <li key={lesson.id}>
                            {lock?.locked ? (
                              <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5" aria-disabled>
                                {row}
                              </div>
                            ) : (
                              <Link
                                href={`/learn/${product.slug}/lesson/${lesson.id}`}
                                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted sm:px-5"
                              >
                                {row}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        ) : null}

        {activeTab === "included" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {bundleItems.map((item) => {
              const progress = bundleProgress.get(item.productId) ?? 0;
              return (
                <Link
                  key={item.productId}
                  href={`/learn/${item.product.slug}`}
                  className="group flex gap-4 rounded-xl border border-border bg-card p-3.5 transition-shadow hover:shadow-md"
                >
                  <ProductCover type={item.product.type} thumbnailUrl={item.product.thumbnailUrl} seed={item.product.slug} className="w-32 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <ProductTypeBadge type={item.product.type} size="sm" />
                    <p className="mt-1.5 line-clamp-2 font-display text-[0.9375rem] leading-snug font-semibold">{item.product.title}</p>
                    <div className="mt-auto flex items-center gap-2 pt-2">
                      <ProgressBar value={progress} size="sm" />
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{progress}%</span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : null}

        {activeTab === "live" ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {upcomingSessions.length > 0 ? (
              <div className="grid gap-3">
                {upcomingSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    productTitle={product.title}
                    pageUrl={absoluteUrl(`/learn/${product.slug}?tab=live`)}
                    timeZone={general.timezone}
                    now={now}
                  />
                ))}
              </div>
            ) : (
              <Callout tone="neutral">No sessions are scheduled right now. New dates will show up here.</Callout>
            )}
            {pastSessions.length > 0 ? (
              <div>
                <h2 className="mb-3 font-display text-base font-semibold">Past sessions</h2>
                <div className="grid gap-3">
                  {pastSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      productTitle={product.title}
                      pageUrl={absoluteUrl(`/learn/${product.slug}?tab=live`)}
                      timeZone={general.timezone}
                      now={now}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "files" ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
            {productAssets.length > 0 ? <AssetList assets={productAssets} /> : null}
            {lessonAssets.length > 0 ? (
              <div>
                <h2 className="mb-3 font-display text-base font-semibold">From the lessons</h2>
                <AssetList assets={lessonAssets} />
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "updates" ? (
          <ol className="relative ml-2 grid gap-6 border-l border-border pl-6">
            {product.updates.map((update, index) => (
              <li key={update.id} className="relative">
                <span
                  className={cn(
                    "absolute top-1.5 -left-[1.8125rem] size-2.5 rounded-full ring-4 ring-background",
                    index === 0 ? "bg-primary" : "bg-border-strong",
                  )}
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2">
                  {update.version ? <Badge variant={index === 0 ? "primary" : "neutral"}>v{update.version}</Badge> : null}
                  {index === 0 ? <Badge variant="spark" size="sm">Latest</Badge> : null}
                  <time className="text-xs text-muted-foreground" dateTime={update.publishedAt.toISOString()}>
                    {formatDate(update.publishedAt, { ...dateOptions, style: "long" })}
                  </time>
                </div>
                <h3 className="mt-1.5 font-display text-base font-semibold">{update.title}</h3>
                <RichText html={update.body} small className="mt-1.5 text-muted-foreground" />
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      {product.description && activeTab === tabs[0]?.id ? (
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">About this {PRODUCT_TYPE_LABELS[product.type].toLowerCase()}</h2>
          <RichText html={product.description} small className="max-w-[46rem]" />
        </section>
      ) : null}
    </div>
  );
}
