import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-md border border-input bg-card text-sm text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-danger aria-invalid:ring-danger/20";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(controlBase, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(controlBase, "min-h-20 px-3 py-2 leading-relaxed", className)} {...props} />;
}

/** Native select: best keyboard, screen-reader and mobile behaviour for simple choices. */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-10 appearance-none py-0 pr-9 pl-3", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[0.8125rem] font-medium text-foreground", className)} {...props} />;
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4.5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-input bg-card shadow-xs transition-colors checked:border-primary checked:bg-primary checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3.5 8.5l3 3 6-7%22/></svg>')] bg-center bg-no-repeat focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

type FieldProps = {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + hint/error, stacked. */
export function Field({ label, htmlFor, hint, error, optional, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor}>{label}</Label>
          {optional ? <span className="text-xs text-muted-foreground">Optional</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="text-[0.8125rem] font-medium text-danger-text" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8125rem] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
