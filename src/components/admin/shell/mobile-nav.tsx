"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import type { AdminNavItem } from "@/components/admin/shell/nav";
import { SidebarNav } from "@/components/admin/shell/sidebar-nav";

/** Hamburger button + slide-in drawer with the admin navigation (phones and tablets). */
export function MobileNav({ items, header }: { items: AdminNavItem[]; header: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className="grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" title="Admin menu" hideTitle className="w-[82vw] max-w-72">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">{header}</div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
