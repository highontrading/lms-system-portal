import Link from "next/link";
import {
  ArrowRight, Award, Bot, CalendarDays, Clock, Download, Library, MessageCircle, Play, Rocket, ShieldCheck, Sparkles, Star,
  Users, Video, Workflow, Zap,
  type LucideIcon,
} from "lucide-react";
import { ProductCard } from "@/components/site/product-card";
import { PRODUCT_TYPE_ICONS } from "@/components/product/visuals";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/interactive";
import { Avatar } from "@/components/ui/misc";
import { PRODUCT_TYPE_DESCRIPTIONS, PRODUCT_TYPE_PLURALS, PRODUCT_TYPE_SLUGS } from "@/lib/labels";
import { safeHref } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { listCatalog, ownedProductIds } from "@/server/catalog";
import { getSettings } from "@/server/settings";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles, library: Library, play: Play, video: Video, bot: Bot, award: Award, message: MessageCircle,
  zap: Zap, workflow: Workflow, clock: Clock, shield: ShieldCheck, download: Download, users: Users, rocket: Rocket,
  calendar: CalendarDays, star: Star,
};

export default async function HomePage() {
  const [{ home, general }, session] = await Promise.all([getSettings(), getSession()]);
  const [featured, all, owned] = await Promise.all([
    listCatalog({ featuredOnly: true, take: 6 }),
    listCatalog({ take: 6 }),
    ownedProductIds(session?.user.id),
  ]);
  const products = featured.length >= 2 ? featured : all;
  const types = [...new Set(all.map((product) => product.type))];
  const cardProps = { currency: general.currency, locale: general.locale, timezone: general.timezone };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0d0b1c] text-white">
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(55% 60% at 80% 0%, color-mix(in oklab, var(--brand) 75%, transparent), transparent 70%), radial-gradient(40% 50% at 0% 100%, color-mix(in oklab, var(--brand) 45%, #ff5fa2 25%), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 bg-grid text-white/50 [mask-image:radial-gradient(70%_70%_at_50%_30%,black,transparent)]" aria-hidden />
        <div className="container-page relative py-16 sm:py-24 lg:py-28">
          <div className="max-w-3xl animate-rise">
            {home.heroBadge ? (
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                <span className="size-1.5 rounded-full bg-spark" />
                {home.heroBadge}
              </p>
            ) : null}
            <h1 className="font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl lg:text-[4.25rem]">
              {home.heroTitle} {home.heroHighlight ? <span className="text-spark">{home.heroHighlight}</span> : null}
            </h1>
            {home.heroSubtitle ? <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">{home.heroSubtitle}</p> : null}
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {home.heroPrimaryLabel && safeHref(home.heroPrimaryHref) ? (
                <Button asChild size="lg" variant="spark" className="h-13 px-7 text-base">
                  <Link href={safeHref(home.heroPrimaryHref)!}>
                    {home.heroPrimaryLabel} <ArrowRight />
                  </Link>
                </Button>
              ) : null}
              {home.heroSecondaryLabel && safeHref(home.heroSecondaryHref) ? (
                <Button asChild size="lg" className="h-13 border border-white/20 bg-white/8 px-7 text-base text-white hover:bg-white/14">
                  <Link href={safeHref(home.heroSecondaryHref)!}>{home.heroSecondaryLabel}</Link>
                </Button>
              ) : null}
            </div>
            {home.stats.length > 0 ? (
              <dl className="mt-12 grid max-w-xl grid-cols-2 gap-6 sm:grid-cols-4">
                {home.stats.map((stat) => (
                  <div key={stat.label}>
                    <dd className="font-display text-2xl font-semibold">{stat.value}</dd>
                    <dt className="text-sm text-white/60">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </div>
      </section>

      {/* What you can get here */}
      {home.showTypes && types.length > 1 ? (
        <section className="container-page pt-14">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {types.slice(0, 4).map((type) => {
              const Icon = PRODUCT_TYPE_ICONS[type];
              return (
                <Link
                  key={type}
                  href={`/catalog?type=${PRODUCT_TYPE_SLUGS[type]}`}
                  className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-xs transition-colors hover:border-border-strong"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-text">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display font-semibold group-hover:text-primary-text">{PRODUCT_TYPE_PLURALS[type]}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{PRODUCT_TYPE_DESCRIPTIONS[type]}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Featured */}
      {home.showFeatured && products.length > 0 ? (
        <section className="container-page pt-16">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl font-semibold tracking-tight">{home.featuredTitle}</h2>
              {home.featuredSubtitle ? <p className="mt-1.5 text-muted-foreground">{home.featuredSubtitle}</p> : null}
            </div>
            <Button asChild variant="secondary">
              <Link href="/catalog">
                View everything <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} owned={owned.has(product.id)} {...cardProps} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Benefits */}
      {home.showBenefits && home.benefits.length > 0 ? (
        <section className="container-page pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight">{home.benefitsTitle}</h2>
            {home.benefitsSubtitle ? <p className="mt-2 text-muted-foreground">{home.benefitsSubtitle}</p> : null}
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {home.benefits.map((benefit) => {
              const Icon = ICONS[benefit.icon] ?? Sparkles;
              return (
                <div key={benefit.title} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary-text">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{benefit.title}</h3>
                  {benefit.body ? <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{benefit.body}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Testimonials — only shown once the owner adds real ones */}
      {home.showTestimonials && home.testimonials.length > 0 ? (
        <section className="container-page pt-20">
          <h2 className="text-center font-display text-3xl font-semibold tracking-tight">{home.testimonialsTitle}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {home.testimonials.map((item) => (
              <figure key={item.name + item.quote.slice(0, 12)} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <blockquote className="text-[0.9375rem] leading-relaxed">“{item.quote}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <Avatar name={item.name} src={item.avatarUrl || null} size="md" />
                  <span>
                    <span className="block text-sm font-semibold">{item.name}</span>
                    {item.role ? <span className="block text-xs text-muted-foreground">{item.role}</span> : null}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      {home.showFaq && home.faqs.length > 0 ? (
        <section className="container-page pt-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-3xl font-semibold tracking-tight">{home.faqTitle}</h2>
            <Accordion type="single" collapsible className="mt-8 rounded-2xl border border-border bg-card px-5 shadow-xs sm:px-6">
              {home.faqs.map((faq, index) => (
                <AccordionItem key={index} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      ) : null}

      {/* Closing call to action */}
      {home.showCta ? (
        <section className="container-page pt-20">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
            <div className="relative">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{home.ctaTitle}</h2>
              {home.ctaSubtitle ? <p className="mx-auto mt-3 max-w-xl opacity-85">{home.ctaSubtitle}</p> : null}
              {home.ctaLabel && safeHref(home.ctaHref) ? (
                <Button asChild size="lg" variant="spark" className="mt-7 h-13 px-7 text-base">
                  <Link href={safeHref(home.ctaHref)!}>
                    {home.ctaLabel} <ArrowRight />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
