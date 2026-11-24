import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarClock, Check, CircleCheck, ClipboardList, Clock, Code2, Download, ExternalLink, FileText, Globe, Link2, Lock,
  PlayCircle, SignalHigh, Users,
} from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import { RichText } from "@/components/content";
import { LocalTime } from "@/components/local-time";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { JoinFreeButton } from "@/components/site/join-button";
import { ProductCard } from "@/components/site/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/interactive";
import { Avatar, Callout } from "@/components/ui/misc";
import { LEVEL_LABELS, PRODUCT_TYPE_CTA, PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { isStaff } from "@/lib/permissions";
import { discountPercent, formatDuration, formatMoney, safeHref, stripHtml, truncate } from "@/lib/utils";
import { isEnrollmentActive, seatsRemaining } from "@/server/access";
import { getSession } from "@/server/auth/session";
import { ownedProductIds } from "@/server/catalog";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

const LESSON_ICONS: Record<LessonType, typeof FileText> = {
  VIDEO: PlayCircle,
  TEXT: FileText,
  QUIZ: ClipboardList,
  ASSIGNMENT: ClipboardList,
  DOWNLOAD: Download,
  EMBED: Globe,
};

async function loadProduct(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      instructors: { orderBy: { position: "asc" } },
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { isPublished: true },
            orderBy: { position: "asc" },
            select: { id: true, title: true, type: true, durationSeconds: true, isPreview: true },
          },
        },
      },
      liveSessions: { orderBy: { startsAt: "asc" } },
      assets: { where: { lessonId: null }, orderBy: { position: "asc" }, select: { id: true, kind: true, title: true } },
      bundleItems: {
        orderBy: { position: "asc" },
        include: {
          product: {
            select: {
              id: true, slug: true, type: true, title: true, tagline: true, thumbnailUrl: true, price: true,
              compareAtPrice: true, durationLabel: true, status: true,
            },
          },
        },
      },
      _count: { select: { lessons: { where: { isPublished: true } } } },
    },
  });
}

/** Sessions that haven't finished yet. */
function upcomingSessions<T extends { status: string; startsAt: Date; durationMinutes: number }>(sessions: T[]) {
  const now = Date.now();
  return sessions.filter((item) => item.status !== "CANCELLED" && item.startsAt.getTime() + item.durationMinutes * 60_000 > now);
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: { title: true, tagline: true, description: true, seoTitle: true, seoDescription: true, thumbnailUrl: true, status: true },
  });
  if (!product || product.status !== "PUBLISHED") return { title: "Not found" };
  const description = product.seoDescription || product.tagline || truncate(stripHtml(product.description), 160);
  return {
    title: product.seoTitle || product.title,
    description,
    openGraph: { title: product.title, description, images: product.thumbnailUrl ? [product.thumbnailUrl] : undefined },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, session, { general }] = await Promise.all([loadProduct(slug), getSession(), getSettings()]);
  const staff = !!session && isStaff(session.user.role);

  // Private products have no public page; drafts are only previewable by staff.
  if (!product || product.status === "ARCHIVED") notFound();
  if (!staff && (product.status !== "PUBLISHED" || product.visibility === "PRIVATE")) notFound();

  const [enrollment, seats, owned] = await Promise.all([
    session
      ? db.enrollment.findUnique({ where: { userId_productId: { userId: session.user.id, productId: product.id } } })
      : null,
    seatsRemaining(product),
    ownedProductIds(session?.user.id),
  ]);
  const hasAccess = isEnrollmentActive(enrollment);
  const isFree = product.price === 0;
  const checkoutUrl = safeHref(product.checkoutUrl);
  const soldOut = seats !== null && seats <= 0 && !hasAccess;
  const upcoming = upcomingSessions(product.liveSessions);
  const totalSeconds = product.sections.flatMap((s) => s.lessons).reduce((sum, lesson) => sum + (lesson.durationSeconds ?? 0), 0);
  const sections = product.sections.filter((section) => section.lessons.length > 0);
  const off = discountPercent(product.price, product.compareAtPrice);
  const money = (value: number) => formatMoney(value, general.currency, general.locale);
  const faqs = Array.isArray(product.faqs) ? (product.faqs as { q?: string; a?: string }[]).filter((f) => f.q && f.a) : [];

  const facts = [
    product._count.lessons > 0 ? { icon: PlayCircle, text: `${product._count.lessons} lessons` } : null,
    product.durationLabel
      ? { icon: Clock, text: product.durationLabel }
      : totalSeconds > 0
        ? { icon: Clock, text: formatDuration(totalSeconds) }
        : null,
    product.level !== "ALL" ? { icon: SignalHigh, text: LEVEL_LABELS[product.level] } : null,
    upcoming.length > 0 ? { icon: CalendarClock, text: `${upcoming.length} live session${upcoming.length === 1 ? "" : "s"}` } : null,
    product.platform ? { icon: Code2, text: product.platform } : null,
  ].filter(Boolean) as { icon: typeof Clock; text: string }[];

  return (
    <div className="container-page py-8 sm:py-12">
      {product.status !== "PUBLISHED" ? (
        <Callout tone="warning" className="mb-6" title="Preview">
          This product is a {product.status.toLowerCase()} and only visible to your team.
        </Callout>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]">
        {/* Main column */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ProductTypeBadge type={product.type} />
            {product.category ? <Badge variant="neutral">{product.category.name}</Badge> : null}
            {product.version ? <Badge variant="outline">v{product.version}</Badge> : null}
          </div>
          <h1 className="mt-4 font-display text-3xl leading-tight font-semibold tracking-tight sm:text-[2.6rem]">{product.title}</h1>
          {product.tagline ? <p className="mt-3 text-lg text-muted-foreground">{product.tagline}</p> : null}
          {facts.length > 0 ? (
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {facts.map((fact) => (
                <li key={fact.text} className="inline-flex items-center gap-1.5">
                  <fact.icon className="size-4" /> {fact.text}
                </li>
              ))}
            </ul>
          ) : null}

          <ProductCover
            type={product.type}
            thumbnailUrl={product.thumbnailUrl}
            seed={product.slug}
            title={product.title}
            className="mt-7 rounded-2xl lg:hidden"
            eager
          />

          {product.description ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">About this {PRODUCT_TYPE_LABELS[product.type].toLowerCase()}</h2>
              <RichText html={product.description} />
            </section>
          ) : null}

          {product.outcomes.length > 0 ? (
            <section className="mt-9 rounded-2xl border border-border bg-card p-6 shadow-xs">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                {product.type === "COURSE" || product.type === "WORKSHOP" ? "What you'll learn" : "What you get"}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {product.outcomes.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Live sessions</h2>
              <ul className="grid gap-3">
                {upcoming.map((item) => (
                  <li key={item.id} className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                      <CalendarClock className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        <LocalTime date={item.startsAt} format="weekday-datetime" showZone fallbackZone={general.timezone} /> ·{" "}
                        {item.durationMinutes} min{item.platform ? ` · ${item.platform}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Times are shown in your own time zone. Replays are added after each session.</p>
            </section>
          ) : null}

          {sections.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">
                {product.type === "COURSE" ? "Course content" : product.type === "WORKSHOP" ? "Materials" : "Setup guide"}
              </h2>
              <Accordion type="multiple" defaultValue={[sections[0].id]} className="rounded-2xl border border-border bg-card px-5 shadow-xs">
                {sections.map((section) => (
                  <AccordionItem key={section.id} value={section.id}>
                    <AccordionTrigger>
                      <span className="flex min-w-0 flex-col">
                        <span>{section.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {section.lessons.length} lesson{section.lessons.length === 1 ? "" : "s"}
                          {section.dripDays ? ` · unlocks after ${section.dripDays} days` : ""}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="text-foreground">
                      <ul className="grid gap-1">
                        {section.lessons.map((lesson) => {
                          const Icon = LESSON_ICONS[lesson.type];
                          return (
                            <li key={lesson.id} className="flex items-center gap-3 rounded-md px-1 py-1.5">
                              <Icon className="size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                              {lesson.isPreview ? <Badge variant="primary" size="sm">Free preview</Badge> : hasAccess ? null : <Lock className="size-3.5 text-muted-foreground" />}
                              {lesson.durationSeconds ? (
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatDuration(lesson.durationSeconds)}</span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}

          {product.assets.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Included files and links</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {product.assets.map((asset) => (
                  <li key={asset.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-xs">
                    {asset.kind === "FILE" ? <Download className="size-4 text-muted-foreground" /> : asset.kind === "LINK" ? <Link2 className="size-4 text-muted-foreground" /> : <Code2 className="size-4 text-muted-foreground" />}
                    <span className="min-w-0 truncate">{asset.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {product.type === "BUNDLE" && product.bundleItems.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">What&apos;s included</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {product.bundleItems
                  .filter((item) => item.product.status === "PUBLISHED")
                  .map((item) => (
                    <ProductCard
                      key={item.product.id}
                      product={item.product}
                      owned={owned.has(item.product.id)}
                      currency={general.currency}
                      locale={general.locale}
                      timezone={general.timezone}
                    />
                  ))}
              </div>
            </section>
          ) : null}

          {product.requirements.length > 0 || product.audience.length > 0 ? (
            <section className="mt-9 grid gap-6 sm:grid-cols-2">
              {product.audience.length > 0 ? (
                <div>
                  <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Who it&apos;s for</h2>
                  <ul className="grid gap-2 text-sm text-muted-foreground">
                    {product.audience.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Users className="mt-0.5 size-4 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {product.requirements.length > 0 ? (
                <div>
                  <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">What you need</h2>
                  <ul className="grid gap-2 text-sm text-muted-foreground">
                    {product.requirements.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}

          {product.instructors.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Taught by</h2>
              <div className="grid gap-3">
                {product.instructors.map((person) => (
                  <div key={person.id} className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
                    <Avatar name={person.name} src={person.avatarUrl} size="lg" />
                    <div className="min-w-0">
                      <p className="font-display font-semibold">{person.name}</p>
                      {person.title ? <p className="text-sm text-muted-foreground">{person.title}</p> : null}
                      {person.bio ? <p className="mt-2 text-sm leading-relaxed">{person.bio}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {faqs.length > 0 ? (
            <section className="mt-9">
              <h2 className="mb-3 font-display text-xl font-semibold tracking-tight">Questions</h2>
              <Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5 shadow-xs">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`faq-${index}`}>
                    <AccordionTrigger>{faq.q}</AccordionTrigger>
                    <AccordionContent>{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ) : null}
        </div>

        {/* Access card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
            <ProductCover
              type={product.type}
              thumbnailUrl={product.thumbnailUrl}
              seed={product.slug}
              title={product.title}
              rounded={false}
              className="hidden lg:block"
              eager
            />
            <div className="grid gap-4 p-6">
              {hasAccess ? (
                <>
                  <p className="inline-flex items-center gap-2 font-medium text-success-text">
                    <CircleCheck className="size-5" /> You have access
                  </p>
                  <Button asChild size="lg" className="w-full">
                    <Link href={`/learn/${product.slug}`}>Open in my library</Link>
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    {isFree ? (
                      <span className="font-display text-3xl font-semibold">Free</span>
                    ) : (
                      <>
                        <span className="font-display text-3xl font-semibold">{money(product.price)}</span>
                        {off > 0 ? (
                          <>
                            <span className="text-muted-foreground line-through">{money(product.compareAtPrice!)}</span>
                            <Badge variant="spark">{off}% off</Badge>
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                  {seats !== null ? (
                    <p className="text-sm font-medium text-warning-text">
                      {soldOut ? "All seats are taken" : seats <= 10 ? `Only ${seats} seat${seats === 1 ? "" : "s"} left` : `${seats} seats left`}
                    </p>
                  ) : null}

                  {soldOut ? null : isFree ? (
                    session ? (
                      <JoinFreeButton productId={product.id} label="Add to my library — free" />
                    ) : (
                      <Button asChild size="lg" className="w-full">
                        <Link href={`/login?next=${encodeURIComponent(`/catalog/${product.slug}`)}`}>Sign in to get it free</Link>
                      </Button>
                    )
                  ) : checkoutUrl ? (
                    <Button asChild size="lg" className="w-full">
                      <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
                        {PRODUCT_TYPE_CTA[product.type]} <ExternalLink />
                      </a>
                    </Button>
                  ) : null}

                  {!isFree ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Access is added to your library as soon as your purchase is confirmed.{" "}
                      {session ? (
                        "If you already bought this, make sure you're signed in with the email you paid with."
                      ) : (
                        <>
                          Already bought it?{" "}
                          <Link href={`/login?next=${encodeURIComponent(`/learn/${product.slug}`)}`} className="font-medium text-primary-text hover:underline">
                            Sign in
                          </Link>{" "}
                          with the email you paid with.
                        </>
                      )}
                    </p>
                  ) : null}
                </>
              )}

              <ul className="grid gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" />
                  {product.accessDays ? `${product.accessDays} days of access` : "Lifetime access"}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-success" /> Works on phone, tablet and laptop
                </li>
                {product.certificateEnabled ? (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> Certificate on completion
                  </li>
                ) : null}
                {product.version ? (
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-success" /> Free updates included
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
