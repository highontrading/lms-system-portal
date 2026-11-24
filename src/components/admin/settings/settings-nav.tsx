"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  CircleHelp,
  GraduationCap,
  House,
  KeyRound,
  Mail,
  Menu,
  Palette,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  settings: Settings,
  palette: Palette,
  home: House,
  menu: Menu,
  key: KeyRound,
  graduation: GraduationCap,
  award: Award,
  mail: Mail,
  search: Search,
  help: CircleHelp,
};

/** Section switcher: a sticky list on desktop, a swipeable row of pills on phones and tablets. */
export function SettingsNav({ sections }: { sections: { id: string; label: string; icon: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <ul className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {sections.map((section) => {
          const href = `/admin/settings/${section.id}`;
          const active = pathname === href;
          const Icon = ICONS[section.icon] ?? Settings;
          return (
            <li key={section.id} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-md lg:border-transparent lg:px-3",
                  active
                    ? "border-primary/30 bg-primary-soft text-primary-text"
                    : "border-border bg-card text-muted-foreground hover:text-foreground lg:bg-transparent lg:hover:bg-muted",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
