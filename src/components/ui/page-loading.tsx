import { cn } from "@/lib/utils";

/**
 * Route-level loading placeholder. It fades in after a short delay, so fast responses never
 * flash a skeleton while slow ones still get immediate feedback.
 */
export function PageLoading({ variant = "page", className }: { variant?: "page" | "form" | "table"; className?: string }) {
  return (
    <div
      className={cn("animate-fade-in opacity-0 [animation-delay:180ms]", className)}
      role="status"
      aria-label="Loading"
    >
      {variant === "form" ? (
        <div className="grid gap-5">
          <div className="skeleton h-8 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-10 w-full" />
          <div className="skeleton h-12 w-full" />
        </div>
      ) : variant === "table" ? (
        <div className="grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="skeleton h-8 w-52" />
            <div className="skeleton h-9 w-32" />
          </div>
          <div className="skeleton h-10 w-full" />
          <div className="grid gap-2 rounded-xl border border-border bg-card p-4">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="skeleton h-9 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-2">
            <div className="skeleton h-8 w-64 max-w-full" />
            <div className="skeleton h-4 w-96 max-w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-36" />
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      )}
    </div>
  );
}
