import Link from "next/link";
import { CalendarClock, CircleCheck } from "lucide-react";
import type { ProductType } from "@/generated/prisma/enums";
import { LocalTime } from "@/components/local-time";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export type CatalogProduct = {
  id: string;
  slug: string;
  type: ProductType;
  title: string;
  tagline: string | null;
  thumbnailUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  durationLabel: string | null;
  nextSessionAt?: Date | null;
};

export function ProductCard({
  product,
  owned,
  currency,
  locale,
  timezone,
}: {
  product: CatalogProduct;
  owned: boolean;
  currency: string;
  locale: string;
  timezone: string;
}) {
  return (
    <Link
      href={owned ? `/learn/${product.slug}` : `/catalog/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
    >
      <ProductCover type={product.type} thumbnailUrl={product.thumbnailUrl} seed={product.slug} title={product.title} rounded={false} />
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between gap-2">
          <ProductTypeBadge type={product.type} size="sm" />
          {owned ? (
            <Badge variant="success" size="sm">
              <CircleCheck /> In your library
            </Badge>
          ) : null}
        </div>
        <h3 className="font-display text-lg leading-snug font-semibold tracking-tight group-hover:text-primary-text">{product.title}</h3>
        {product.tagline ? <p className="line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p> : null}
        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <div className="min-w-0 text-xs text-muted-foreground">
            {product.nextSessionAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                <LocalTime date={product.nextSessionAt} format="weekday-datetime" fallbackZone={timezone} />
              </span>
            ) : (
              product.durationLabel
            )}
          </div>
          {owned ? null : product.price === 0 ? (
            <span className="text-sm font-semibold text-success-text">Free</span>
          ) : (
            <span className="flex items-baseline gap-1.5 whitespace-nowrap">
              {product.compareAtPrice && product.compareAtPrice > product.price ? (
                <span className="text-xs text-muted-foreground line-through">{formatMoney(product.compareAtPrice, currency, locale)}</span>
              ) : null}
              <span className="text-[0.9375rem] font-semibold">{formatMoney(product.price, currency, locale)}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
