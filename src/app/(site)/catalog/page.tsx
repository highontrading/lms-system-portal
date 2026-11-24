import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { ProductCard } from "@/components/site/product-card";
import { SearchInput } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/misc";
import { PRODUCT_TYPE_PLURALS, PRODUCT_TYPE_SLUGS, PRODUCT_TYPES, productTypeFromSlug } from "@/lib/labels";
import { cn, firstParam, type SearchParams } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { listCatalog, ownedProductIds } from "@/server/catalog";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, { general }, session] = await Promise.all([searchParams, getSettings(), getSession()]);
  const type = productTypeFromSlug(firstParam(params.type));
  const query = firstParam(params.q)?.trim() ?? "";

  const [everything, products, owned] = await Promise.all([
    listCatalog(),
    listCatalog({ type, query }),
    ownedProductIds(session?.user.id),
  ]);
  const availableTypes = PRODUCT_TYPES.filter((item) => everything.some((product) => product.type === item));
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-card text-foreground hover:bg-muted",
    );
  const href = (slug: string | null) => {
    const search = new URLSearchParams();
    if (slug) search.set("type", slug);
    if (query) search.set("q", query);
    const text = search.toString();
    return text ? `/catalog?${text}` : "/catalog";
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-4xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 text-muted-foreground">{general.tagline}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Link href={href(null)} className={chip(!type)}>
            All
          </Link>
          {availableTypes.map((item) => (
            <Link key={item} href={href(PRODUCT_TYPE_SLUGS[item])} className={chip(type === item)}>
              {PRODUCT_TYPE_PLURALS[item]}
            </Link>
          ))}
        </div>
        <SearchInput placeholder="Search the catalog…" />
      </div>

      {products.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={<SearchX />}
          title={everything.length === 0 ? "Nothing published yet" : "No matches"}
          description={everything.length === 0 ? "Check back soon — new programs are on the way." : "Try a different search or clear the filters."}
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              owned={owned.has(product.id)}
              currency={general.currency}
              locale={general.locale}
              timezone={general.timezone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
