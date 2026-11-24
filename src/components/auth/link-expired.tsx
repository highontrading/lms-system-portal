import Link from "next/link";
import { Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when an emailed link is no longer valid. */
export function LinkExpired({
  title = "This link has expired",
  description,
  actionLabel,
  actionHref,
}: {
  title?: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="grid gap-4">
      <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning-text">
        <Link2Off className="size-5" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button asChild size="lg">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
