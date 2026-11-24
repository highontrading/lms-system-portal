"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ProductType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

type Tab = { label: string; segment: string; hideForBundle?: boolean };

const TABS: Tab[] = [
  { label: "Details", segment: "" },
  { label: "Content", segment: "curriculum", hideForBundle: true },
  { label: "Live sessions", segment: "sessions", hideForBundle: true },
  { label: "Files & links", segment: "files", hideForBundle: true },
  { label: "Updates", segment: "updates", hideForBundle: true },
  { label: "Access", segment: "access" },
  { label: "Settings", segment: "settings" },
];

/** Link-based tabs for the product editor; scrolls sideways on narrow screens. */
export function EditorTabs({ productId, type }: { productId: string; type: ProductType }) {
  const pathname = usePathname();
  const base = `/admin/products/${productId}`;
  const tabs = TABS.filter((tab) => !(type === "BUNDLE" && tab.hideForBundle));

  return (
    <nav aria-label="Product sections" className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        // The lesson editor lives under /lessons but belongs to the Content tab.
        const active = tab.segment
          ? pathname === href || pathname.startsWith(`${href}/`) || (tab.segment === "curriculum" && pathname.startsWith(`${base}/lessons`))
          : pathname === base;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
