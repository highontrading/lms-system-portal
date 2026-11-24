import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn, initials } from "@/lib/utils";

// ───────────────────────────── Avatar ─────────────────────────────

const avatarSizes = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

// Soft, distinct backgrounds so initials avatars are easy to tell apart in lists.
const avatarTints = [
  "bg-[oklch(0.92_0.06_285)] text-[oklch(0.4_0.16_285)]",
  "bg-[oklch(0.93_0.07_160)] text-[oklch(0.4_0.11_160)]",
  "bg-[oklch(0.93_0.07_70)] text-[oklch(0.45_0.12_60)]",
  "bg-[oklch(0.93_0.06_20)] text-[oklch(0.47_0.16_20)]",
  "bg-[oklch(0.93_0.05_235)] text-[oklch(0.43_0.13_240)]",
  "bg-[oklch(0.93_0.07_330)] text-[oklch(0.45_0.16_330)]",
];

function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return avatarTints[hash % avatarTints.length];
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof avatarSizes;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn("shrink-0 rounded-full bg-muted object-cover", avatarSizes[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold select-none",
        avatarSizes[size],
        tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

// ───────────────────────────── Progress ─────────────────────────────

export function ProgressBar({
  value,
  className,
  size = "md",
  label,
}: {
  value: number;
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
      className={cn("w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-1.5" : "h-2", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          clamped >= 100 ? "bg-success" : "bg-primary",
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  className,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={cn("relative grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", clamped >= 100 ? "stroke-success" : "stroke-primary")}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">
        {children ?? `${Math.round(clamped)}%`}
      </div>
    </div>
  );
}

// ───────────────────────────── Feedback ─────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn("size-5 animate-spin text-muted-foreground", className)} aria-label="Loading" />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-card/60 px-6 text-center",
        compact ? "py-8" : "py-14",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary-soft text-primary-text [&_svg]:size-5.5">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

type CalloutTone = "info" | "success" | "warning" | "danger" | "neutral";

const calloutTones: Record<CalloutTone, string> = {
  info: "border-info/25 bg-info-soft text-info-text",
  success: "border-success/25 bg-success-soft text-success-text",
  warning: "border-warning/35 bg-warning-soft text-warning-text",
  danger: "border-danger/25 bg-danger-soft text-danger-text",
  neutral: "border-border bg-muted text-foreground",
};

export function Callout({
  tone = "info",
  icon,
  title,
  children,
  className,
  action,
}: {
  tone?: CalloutTone;
  icon?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", calloutTones[tone], className)}>
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4.5">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("leading-relaxed", title && "mt-0.5 opacity-90")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" className={cn("shrink-0 bg-border", vertical ? "h-full w-px" : "h-px w-full", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border-strong bg-muted px-1 font-mono text-[0.6875rem] text-muted-foreground">
      {children}
    </kbd>
  );
}

/** Five-star rating display with fractional fill. */
export function Stars({ value, className, size = 14 }: { value: number; className?: string; size?: number }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  const star = "M10 1.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.8l6-.8z";
  const row = (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden className="shrink-0">
          <path d={star} />
        </svg>
      ))}
    </>
  );
  return (
    <span className={cn("relative inline-flex", className)} role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="flex text-border-strong">{row}</span>
      <span className="absolute inset-y-0 left-0 flex overflow-hidden text-[#f5a524]" style={{ width: `${percent}%` }}>
        {row}
      </span>
    </span>
  );
}
