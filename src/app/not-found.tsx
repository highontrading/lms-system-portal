import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary-text">
          <Compass className="size-7" />
        </span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">It may have been moved, or the link might be mistyped.</p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Go to my learning</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/catalog">Browse the catalog</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
