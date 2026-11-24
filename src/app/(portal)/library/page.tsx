import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Library, SearchX } from "lucide-react";
import { OwnedProductCard } from "@/components/portal/dashboard/product-card";
import { ProductTypeIcon } from "@/components/product/visuals";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_PLURALS, PRODUCT_TYPES, productTypeFromSlug, PRODUCT_TYPE_SLUGS } from "@/lib/labels";
import { cn, firstParam, formatDate, type SearchParams } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { getLibrary } from "@/server/portal/dashboard";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "My library" };

export default async function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireUser();
  const [params, { general }, { active, lapsed }] = await Promise.all([searchParams, getSettings(), getLibrary(user.id)]);

  const now = new Date();
  const typeFilter = productTypeFromSlug(firstParam(params.type));
  const query = (firstParam(params.q) ?? "").trim().toLowerCase();

  const typesOwned = PRODUCT_TYPES.filter((type) => active.some((item) => item.type === type));
  const visible = active.filter(
    (item) =>
      (!typeFilter || item.type === typeFilter) &&
      (!query || item.title.toLowerCase().includes(query) || (item.tagline ?? "").toLowerCase().includes(query)),
  );

  const chipHref = (slug: string | null) => {
    const search = new URLSearchParams();
    if (slug) search.set("type", slug);
    if (query) search.set("q", query);
    const qs = search.toString();
    return qs ? `/library?${qs}` : "/library";
  };
  const chipClass = (selected: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
      selected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border-strong bg-card text-foreground hover:bg-muted",
    );

  return (
    <div>
      <PageHeader
        title="My library"
        description={
          active.length === 0
            ? "Everything you get access to shows up here."
            : `${active.length} ${active.length === 1 ? "product" : "products"} you can open any time.`
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<Library />}
          title="Your library is empty"
          description="Courses, workshops, agents and workflows appear here the moment your access is granted. If you bought something, check that you signed in with the email you used at checkout."
          action={
            <Button asChild>
              <Link href="/catalog">
                <Compass /> Browse the catalog
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {typesOwned.length > 1 ? (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filter by type">
                <Link href={chipHref(null)} className={chipClass(!typeFilter)} aria-current={!typeFilter ? "true" : undefined}>
                  All
                  <span className={cn("tabular-nums", !typeFilter ? "opacity-80" : "text-muted-foreground")}>{active.length}</span>
                </Link>
                {typesOwned.map((type) => (
                  <Link
                    key={type}
                    href={chipHref(PRODUCT_TYPE_SLUGS[type])}
                    className={chipClass(typeFilter === type)}
                    aria-current={typeFilter === type ? "true" : undefined}
                  >
                    <ProductTypeIcon type={type} className="size-3.5" />
                    {PRODUCT_TYPE_PLURALS[type]}
                    <span className={cn("tabular-nums", typeFilter === type ? "opacity-80" : "text-muted-foreground")}>
                      {active.filter((item) => item.type === type).length}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <span />
            )}
            <SearchInput placeholder="Search your library…" className="md:max-w-64" />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={<SearchX />}
              title="Nothing matches"
              description="Try a different search or clear the filters."
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/library">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <OwnedProductCard key={item.enrollmentId} item={item} locale={general.locale} timeZone={general.timezone} now={now} />
              ))}
            </div>
          )}
        </>
      )}

      {lapsed.length > 0 ? (
        <details className="group mt-10 rounded-xl border border-border bg-card">
          <summary className="flex list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span>
              Expired or removed <span className="text-muted-foreground">({lapsed.length})</span>
            </span>
            <span className="text-xs text-muted-foreground group-open:hidden">Show</span>
            <span className="hidden text-xs text-muted-foreground group-open:inline">Hide</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {lapsed.map((item) => (
              <li key={item.enrollmentId} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <ProductTypeIcon type={item.type} className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {PRODUCT_TYPE_LABELS[item.type]} ·{" "}
                    {item.revoked
                      ? "Access removed"
                      : item.expiresAt
                        ? `Access ended ${formatDate(item.expiresAt, { locale: general.locale, timeZone: general.timezone })}`
                        : "Access ended"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
