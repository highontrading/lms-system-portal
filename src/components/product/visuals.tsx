import { Bot, Boxes, GraduationCap, Package, Presentation, Workflow, type LucideIcon } from "lucide-react";
import type { ProductType } from "@/generated/prisma/enums";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const PRODUCT_TYPE_ICONS: Record<ProductType, LucideIcon> = {
  COURSE: GraduationCap,
  WORKSHOP: Presentation,
  AGENT: Bot,
  WORKFLOW: Workflow,
  DIGITAL: Package,
  BUNDLE: Boxes,
};

export function ProductTypeIcon({ type, className }: { type: ProductType; className?: string }) {
  const Icon = PRODUCT_TYPE_ICONS[type];
  return <Icon className={className} aria-hidden />;
}

export function ProductTypeBadge({
  type,
  className,
  size,
}: {
  type: ProductType;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = PRODUCT_TYPE_ICONS[type];
  return (
    <Badge variant="primary" size={size} className={className}>
      <Icon aria-hidden />
      {PRODUCT_TYPE_LABELS[type]}
    </Badge>
  );
}

// One recognisable colour story per product type, so a library of mixed products scans quickly.
const COVER_GRADIENTS: Record<ProductType, [string, string, string]> = {
  COURSE: ["oklch(0.5 0.24 285)", "oklch(0.42 0.2 265)", "oklch(0.72 0.17 310)"],
  WORKSHOP: ["oklch(0.66 0.2 40)", "oklch(0.56 0.22 12)", "oklch(0.83 0.15 80)"],
  AGENT: ["oklch(0.58 0.14 185)", "oklch(0.45 0.12 215)", "oklch(0.8 0.15 160)"],
  WORKFLOW: ["oklch(0.55 0.19 255)", "oklch(0.44 0.17 280)", "oklch(0.78 0.13 215)"],
  DIGITAL: ["oklch(0.68 0.17 70)", "oklch(0.58 0.2 35)", "oklch(0.86 0.14 95)"],
  BUNDLE: ["oklch(0.4 0.09 285)", "oklch(0.28 0.07 280)", "oklch(0.7 0.2 300)"],
};

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Product artwork. Uses the uploaded thumbnail when there is one; otherwise draws a cover
 * from the product type and a seed, so the catalog never shows grey placeholders.
 */
export function ProductCover({
  type,
  thumbnailUrl,
  seed,
  title,
  className,
  rounded = true,
  eager,
}: {
  type: ProductType;
  thumbnailUrl?: string | null;
  seed: string;
  title?: string;
  className?: string;
  rounded?: boolean;
  eager?: boolean;
}) {
  const base = cn("relative aspect-video w-full overflow-hidden bg-muted", rounded && "rounded-lg", className);

  if (thumbnailUrl) {
    return (
      <div className={base}>
        <img
          src={thumbnailUrl}
          alt={title ?? ""}
          loading={eager ? "eager" : "lazy"}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    );
  }

  const [from, to, glow] = COVER_GRADIENTS[type];
  const h = hash(seed);
  const variant = h % 4;
  const cx = 62 + (h % 30);
  const cy = 14 + ((h >> 3) % 40);
  const Icon = PRODUCT_TYPE_ICONS[type];

  return (
    <div className={base} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} role="img" aria-label={title ?? PRODUCT_TYPE_LABELS[type]}>
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <defs>
          <radialGradient id={`glow-${h}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glow} stopOpacity="0.75" />
            <stop offset="100%" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r="58" fill={`url(#glow-${h})`} />
        {variant === 0 ? (
          <g fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="0.7">
            {[18, 30, 42, 54, 66].map((r) => (
              <circle key={r} cx="132" cy="78" r={r} />
            ))}
          </g>
        ) : null}
        {variant === 1 ? (
          <g fill="white" fillOpacity="0.14">
            {Array.from({ length: 60 }, (_, i) => (
              <circle key={i} cx={8 + (i % 12) * 13} cy={8 + Math.floor(i / 12) * 16} r="1" />
            ))}
          </g>
        ) : null}
        {variant === 2 ? (
          <g stroke="white" strokeOpacity="0.14" strokeWidth="0.7">
            {Array.from({ length: 14 }, (_, i) => (
              <line key={i} x1={-20 + i * 16} y1="90" x2={30 + i * 16} y2="0" />
            ))}
          </g>
        ) : null}
        {variant === 3 ? (
          <g fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="0.7">
            <rect x="96" y="-14" width="70" height="70" rx="14" transform="rotate(18 131 21)" />
            <rect x="110" y="6" width="70" height="70" rx="14" transform="rotate(18 145 41)" />
          </g>
        ) : null}
      </svg>
      <div className="absolute inset-0 flex items-end p-[7%]">
        <span className="grid aspect-square w-[19%] min-w-9 place-items-center rounded-[26%] bg-white/16 text-white ring-1 ring-white/25 backdrop-blur-sm">
          <Icon className="size-[52%]" strokeWidth={1.7} aria-hidden />
        </span>
      </div>
    </div>
  );
}
