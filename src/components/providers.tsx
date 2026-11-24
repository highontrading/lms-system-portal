"use client";

import { TooltipProvider } from "@/components/ui/interactive";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250} skipDelayDuration={300}>
      {children}
    </TooltipProvider>
  );
}
