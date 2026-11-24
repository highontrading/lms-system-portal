"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Bell, Compass, House, Library, Megaphone, NotebookPen, Radio, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should light this item up. */
  also?: string[];
};

const SIDEBAR_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/library", label: "My library", icon: Library, also: ["/learn"] },
  { href: "/live", label: "Live sessions", icon: Radio },
  { href: "/certificates", label: "Certificates", icon: Award },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/library", label: "Library", icon: Library, also: ["/learn"] },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/account", label: "Account", icon: UserRound },
];

function isActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Left sidebar navigation (laptop and wider). */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
      {SIDEBAR_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary-text"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon
              className={cn("size-[1.125rem] shrink-0", active ? "text-primary-text" : "text-muted-foreground group-hover:text-foreground")}
              strokeWidth={active ? 2.2 : 1.9}
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4">
        <Link
          href="/catalog"
          className="flex items-center gap-3 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary-soft hover:text-primary-text"
        >
          <Compass className="size-[1.125rem] shrink-0" strokeWidth={1.9} aria-hidden />
          Browse catalog
        </Link>
      </div>
    </nav>
  );
}

/** Thumb-reach tab bar for phones and tablets. */
export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/92 pb-safe backdrop-blur-lg lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {BOTTOM_ITEMS.map((item) => {
          const active = isActive(pathname, item);
          const showDot = item.href === "/notifications" && unread > 0;
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={showDot ? `${item.label}, ${unread} unread` : item.label}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors",
                  active ? "text-primary-text" : "text-muted-foreground active:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative grid h-7 w-12 place-items-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                  {showDot ? (
                    <span className="absolute top-0.5 right-2.5 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden />
                  ) : null}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
