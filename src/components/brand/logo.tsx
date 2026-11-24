import Link from "next/link";
import { cn } from "@/lib/utils";

/** The default mark: a four-point "idea spark" on the brand colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="40" height="40" rx="11" fill="var(--brand)" />
      <path
        d="M20 7.5c.9 6.6 5.9 11.6 12.5 12.5-6.6.9-11.6 5.9-12.5 12.5-.9-6.6-5.9-11.6-12.5-12.5 6.6-.9 11.6-5.9 12.5-12.5z"
        fill="var(--spark)"
      />
      <circle cx="30" cy="10" r="2.2" fill="var(--brand-fg)" opacity="0.9" />
    </svg>
  );
}

type LogoProps = {
  siteName: string;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  href?: string | null;
  className?: string;
  /** Show only the mark (collapsed sidebars, tight headers). */
  compact?: boolean;
  /** Render for a dark surface regardless of theme (e.g. the marketing hero). */
  onDark?: boolean;
};

export function Logo({ siteName, logoUrl, logoDarkUrl, href = "/", className, compact, onDark }: LogoProps) {
  const [first, ...rest] = siteName.trim().split(/\s+/);
  const content = logoUrl ? (
    <>
      <img
        src={onDark && logoDarkUrl ? logoDarkUrl : logoUrl}
        alt={siteName}
        className={cn("h-8 w-auto max-w-44 object-contain", !onDark && logoDarkUrl && "dark:hidden")}
      />
      {!onDark && logoDarkUrl ? (
        <img src={logoDarkUrl} alt={siteName} className="hidden h-8 w-auto max-w-44 object-contain dark:block" />
      ) : null}
    </>
  ) : (
    <>
      <LogoMark />
      {compact ? (
        <span className="sr-only">{siteName}</span>
      ) : (
        <span className="font-display text-[1.0625rem] leading-none font-bold tracking-tight whitespace-nowrap">
          {first}
          {rest.length > 0 ? <span className="font-medium opacity-60"> {rest.join(" ")}</span> : null}
        </span>
      )}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5", onDark ? "text-white" : "text-foreground", className);
  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={cn(classes, "rounded-md")} aria-label={`${siteName} home`}>
      {content}
    </Link>
  );
}
