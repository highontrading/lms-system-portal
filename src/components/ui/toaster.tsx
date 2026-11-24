"use client";

import { Toaster as Sonner } from "sonner";

/** App-wide toast outlet. Call `toast.success(...)` / `toast.error(...)` from `sonner` anywhere on the client. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={8}
      offset={20}
      mobileOffset={84}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-popover !text-foreground !shadow-lg !font-sans !text-sm !py-3 !px-4",
          description: "!text-muted-foreground",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}
