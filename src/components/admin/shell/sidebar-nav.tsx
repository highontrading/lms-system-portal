"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Package,
  Plug,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminNavItem } from "@/components/admin/shell/nav";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  categories: Tags,
  instructors: UserCog,
  students: Users,
  access: KeyRound,
  team: ShieldCheck,
  announcements: Megaphone,
  pages: FileText,
  settings: Settings,
  integrations: Plug,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Grouped admin navigation, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNav({
  items,
  onNavigate,
  className,
}: {
  items: AdminNavItem[];
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const groups: { name: string; items: AdminNavItem[] }[] = [];
  for (const item of items) {
    const group = groups.find((entry) => entry.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }

  return (
    <nav aria-label="Admin" className={cn("flex flex-col gap-5", className)}>
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold tracking-wider text-muted-foreground/80 uppercase">
            {group.name}
          </p>
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary-text"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4.5 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
