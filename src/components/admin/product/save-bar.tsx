"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sticky footer with the save button, so it is always within reach on long forms. */
export function SaveBar({
  dirty,
  pending,
  onReset,
  label = "Save changes",
  className,
}: {
  dirty: boolean;
  pending: boolean;
  onReset?: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-6 flex items-center justify-between gap-3 border-t border-border bg-background/90 px-4 py-3 pb-safe backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8",
        className,
      )}
    >
      <p className="min-w-0 truncate text-[0.8125rem] text-muted-foreground" aria-live="polite">
        {dirty ? "You have unsaved changes" : "All changes saved"}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {onReset && dirty ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} disabled={pending}>
            Discard
          </Button>
        ) : null}
        <Button type="submit" loading={pending} disabled={!dirty}>
          {label}
        </Button>
      </div>
    </div>
  );
}
