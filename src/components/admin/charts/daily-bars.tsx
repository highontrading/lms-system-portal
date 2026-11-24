"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type DailyBarsPoint = { day: string; value: number };

/** A "nice" axis ceiling: 4 for tiny counts, otherwise the next 1/2/5 × 10ⁿ step. */
function niceMax(max: number) {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) {
    if (max <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

function dayLabel(day: string, locale: string, long = false) {
  // Day keys are calendar days; format them as such, independent of the viewer's time zone.
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(long ? { weekday: "short" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * One series of daily counts as thin columns. Every column is a focusable hit target the
 * full height of the plot, with the same read-out on hover and keyboard focus; the data is
 * also available to assistive tech as a table.
 */
export function DailyBars({
  data,
  title,
  unit,
  locale = "en-IN",
  className,
}: {
  data: DailyBarsPoint[];
  /** Names the series — a single series needs no legend. */
  title: string;
  unit: { one: string; many: string };
  locale?: string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((point) => point.value));
  const ceiling = niceMax(max);
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const ticks = [ceiling, ceiling / 2, 0];
  // A date roughly once a week, plus "Today" — spaced so they never collide on a phone.
  const labelEvery = Math.max(1, Math.round(data.length / 4.3));
  const format = (value: number) => `${value.toLocaleString(locale)} ${value === 1 ? unit.one : unit.many}`;

  return (
    <figure className={cn("m-0", className)}>
      <figcaption className="sr-only">
        {title}: {format(total)} in the last {data.length} days.
      </figcaption>

      <div className="flex gap-2">
        {/* Y axis: three recessive ticks */}
        <div className="flex h-40 w-7 shrink-0 flex-col justify-between text-right text-[0.6875rem] leading-none text-muted-foreground tabular-nums" aria-hidden>
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {Number.isInteger(tick) ? tick.toLocaleString(locale) : ""}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-40">
            {/* Gridlines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden>
              <span className="h-px bg-border/70" />
              <span className="h-px bg-border/70" />
              <span className="h-px bg-border-strong" />
            </div>

            {max === 0 ? (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                Nothing in the last {data.length} days yet
              </p>
            ) : null}

            <div
              className="absolute inset-0 grid items-stretch gap-[2px]"
              style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
              onPointerLeave={() => setActive(null)}
            >
              {data.map((point, index) => {
                const height = ceiling > 0 ? (point.value / ceiling) * 100 : 0;
                const isActive = active === index;
                return (
                  <button
                    key={point.day}
                    type="button"
                    aria-label={`${dayLabel(point.day, locale, true)}: ${format(point.value)}`}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive((current) => (current === index ? null : current))}
                    className={cn(
                      "group relative flex min-w-0 cursor-default items-end justify-center rounded-t-sm outline-none focus-visible:bg-muted",
                      isActive && "bg-muted/70",
                    )}
                  >
                    <span
                      className={cn(
                        "block w-full max-w-6 rounded-t-[4px] bg-[#6250d6] transition-[filter] dark:bg-[#9085e9]",
                        isActive && "brightness-110",
                      )}
                      style={{ height: `${height}%`, minHeight: point.value > 0 ? 2 : 0 }}
                    />
                    {isActive ? (
                      <span
                        role="tooltip"
                        className={cn(
                          "pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-left whitespace-nowrap shadow-md",
                          index < 4 ? "left-0" : index > data.length - 5 ? "right-0" : "left-1/2 -translate-x-1/2",
                        )}
                        style={{ bottom: `calc(${Math.min(height, 78)}% + 8px)` }}
                      >
                        <span className="block text-sm font-semibold text-foreground tabular-nums">{format(point.value)}</span>
                        <span className="block text-xs text-muted-foreground">{dayLabel(point.day, locale, true)}</span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* X axis: a handful of dates, never one per column */}
          <div
            className="mt-1.5 grid text-[0.6875rem] leading-none text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
            aria-hidden
          >
            {data.map((point, index) => {
              const last = index === data.length - 1;
              const show = last || (index % labelEvery === 0 && index <= data.length - labelEvery);
              return (
                <span key={point.day} className={cn("relative h-3", last && "text-right")}>
                  {show ? (
                    <span className={cn("absolute whitespace-nowrap", last ? "right-0" : "left-0")}>
                      {last ? "Today" : dayLabel(point.day, locale)}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit.many}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.day}>
              <th scope="row">{dayLabel(point.day, locale, true)}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
