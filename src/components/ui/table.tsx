import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Card-framed table that scrolls sideways on narrow screens instead of breaking the layout. */
export function TableCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-xs", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return <table className={cn("w-full min-w-max border-collapse text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("bg-subtle text-left", className)} {...props} />;
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide whitespace-nowrap text-muted-foreground first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child_td]:border-b-0", className)} {...props} />;
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-subtle/70", className)} {...props} />;
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("border-b border-border px-4 py-3 align-middle first:pl-5 last:pr-5", className)} {...props} />;
}

// ───────────────────────────── Pagination ─────────────────────────────

function pageHref(basePath: string, params: Record<string, string | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  params = {},
  page,
  pageSize,
  total,
  className,
  noun = "result",
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
  className?: string;
  noun?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass =
    "inline-flex h-8.5 items-center gap-1 rounded-md border border-border-strong bg-card px-2.5 text-[0.8125rem] font-medium shadow-xs transition-colors hover:bg-muted";
  const disabledClass = "pointer-events-none opacity-45";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex flex-wrap items-center justify-between gap-3 text-[0.8125rem] text-muted-foreground", className)}
    >
      <p>
        Showing <span className="font-medium text-foreground tabular-nums">{from.toLocaleString("en")}</span>–
        <span className="font-medium text-foreground tabular-nums">{to.toLocaleString("en")}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{total.toLocaleString("en")}</span> {noun}
        {total === 1 ? "" : "s"}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <Link
            href={pageHref(basePath, params, page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={cn(linkClass, "text-foreground", page <= 1 && disabledClass)}
          >
            <ChevronLeft className="size-4" /> Previous
          </Link>
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          <Link
            href={pageHref(basePath, params, page + 1)}
            aria-disabled={page >= pages}
            tabIndex={page >= pages ? -1 : undefined}
            className={cn(linkClass, "text-foreground", page >= pages && disabledClass)}
          >
            Next <ChevronRight className="size-4" />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

/** Parses ?page= into a safe 1-based page number. */
export function parsePage(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
