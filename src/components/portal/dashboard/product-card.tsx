import Link from "next/link";
import { CalendarClock, CircleCheck, Clock } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/misc";
import { cn, formatDate } from "@/lib/utils";
import type { OwnedProduct } from "@/server/portal/dashboard";

const SOON_MS = 14 * 24 * 60 * 60 * 1000;

/** A product the student owns: cover, what it is, and the most useful status line for its type. */
export function OwnedProductCard({
  item,
  locale,
  timeZone,
  now,
  className,
}: {
  item: OwnedProduct;
  locale: string;
  timeZone: string;
  /** The request time, passed in so every card on a page agrees. */
  now: Date;
  className?: string;
}) {
  const hasLessons = item.totalLessons > 0;
  const completed = !!item.completedAt || (hasLessons && item.progressPercent >= 100);
  const expiringSoon = item.expiresAt ? item.expiresAt.getTime() - now.getTime() < SOON_MS : false;

  return (
    <Link
      href={`/learn/${item.slug}`}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
        className,
      )}
    >
      <div className="relative">
        <ProductCover type={item.type} thumbnailUrl={item.thumbnailUrl} seed={item.slug} title={item.title} rounded={false} />
        {completed ? (
          <Badge variant="success" className="absolute top-2.5 right-2.5 shadow-sm">
            <CircleCheck aria-hidden />
            Completed
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <ProductTypeBadge type={item.type} size="sm" />
        <h3 className="line-clamp-2 font-display text-[0.9375rem] leading-snug font-semibold tracking-tight group-hover:text-primary-text">
          {item.title}
        </h3>

        <div className="mt-auto grid gap-2 pt-1">
          {item.type === "WORKSHOP" && item.nextSessionAt ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <CalendarClock className="size-3.5 shrink-0 text-primary-text" aria-hidden />
              <span className="truncate">
                Next: <LocalTime date={item.nextSessionAt} format="weekday-datetime" fallbackZone={timeZone} />
              </span>
            </p>
          ) : null}

          {hasLessons && !completed ? (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {item.completedLessons} of {item.totalLessons} lessons
                </span>
                <span className="font-semibold text-foreground tabular-nums">{item.progressPercent}%</span>
              </div>
              <ProgressBar value={item.progressPercent} size="sm" label={`${item.title} progress`} />
            </div>
          ) : null}

          {!hasLessons && (item.type === "AGENT" || item.type === "WORKFLOW" || item.type === "DIGITAL") ? (
            <p className="text-xs text-muted-foreground">{item.version ? `Version ${item.version}` : "Ready to use"}</p>
          ) : null}
          {hasLessons && item.version && (item.type === "AGENT" || item.type === "WORKFLOW") ? (
            <p className="text-xs text-muted-foreground">Version {item.version}</p>
          ) : null}
          {item.type === "BUNDLE" ? <p className="text-xs text-muted-foreground">Everything in this bundle is in your library</p> : null}

          {item.expiresAt ? (
            <p className={cn("flex items-center gap-1.5 text-xs", expiringSoon ? "font-medium text-warning-text" : "text-muted-foreground")}>
              <Clock className="size-3.5 shrink-0" aria-hidden />
              Access until {formatDate(item.expiresAt, { locale, timeZone })}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
