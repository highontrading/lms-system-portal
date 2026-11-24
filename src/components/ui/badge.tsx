import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary-soft text-primary-text",
        solid: "bg-primary text-primary-foreground",
        success: "bg-success-soft text-success-text",
        warning: "bg-warning-soft text-warning-text",
        danger: "bg-danger-soft text-danger-text",
        info: "bg-info-soft text-info-text",
        spark: "bg-spark text-spark-fg",
        outline: "border border-border-strong text-foreground",
        dark: "bg-foreground text-background",
      },
      size: {
        sm: "px-2 py-0.5 text-[0.6875rem] leading-4",
        md: "px-2.5 py-0.5 text-xs leading-5",
      },
    },
    defaultVariants: { variant: "neutral", size: "md" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/** Small coloured dot + label for statuses in tables. */
export function StatusDot({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "primary";
  children: React.ReactNode;
  className?: string;
}) {
  const colors = {
    neutral: "bg-muted-foreground/60",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    primary: "bg-primary",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap", className)}>
      <span className={cn("size-1.5 rounded-full", colors[tone])} aria-hidden />
      {children}
    </span>
  );
}
