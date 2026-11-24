"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 py-16">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger-text">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">Please try again. If it keeps happening, contact support and mention this code: {error.digest ?? "—"}</p>
        <Button className="mt-7" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
