import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none active:scale-[0.985] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary: "border border-border-strong bg-card text-foreground shadow-xs hover:bg-muted",
        soft: "bg-primary-soft text-primary-text hover:bg-primary-soft-hover",
        ghost: "text-foreground hover:bg-muted",
        danger: "bg-danger text-white shadow-sm hover:brightness-95",
        "danger-soft": "bg-danger-soft text-danger-text hover:brightness-95",
        spark: "bg-spark text-spark-fg shadow-sm hover:brightness-95",
        link: "h-auto! rounded-none! p-0! text-primary-text underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        xs: "h-7 rounded-sm px-2.5 text-xs [&_svg]:size-3.5",
        sm: "h-8.5 rounded-md px-3 text-[0.8125rem] [&_svg]:size-4",
        md: "h-10 rounded-md px-4 text-sm [&_svg]:size-4",
        lg: "h-12 rounded-lg px-6 text-[0.9375rem] [&_svg]:size-[1.125rem]",
        icon: "size-10 rounded-md [&_svg]:size-[1.125rem]",
        "icon-sm": "size-8.5 rounded-md [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

export function Button({ className, variant, size, asChild, loading, disabled, children, type, ...props }: ButtonProps) {
  if (asChild) {
    return (
      <Slot.Root className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
