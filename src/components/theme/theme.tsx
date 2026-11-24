"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const STORAGE_KEY = "theme";

function resolve(choice: ThemeChoice) {
  if (choice === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return choice;
}

function apply(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ defaultTheme, className }: { defaultTheme: ThemeChoice; className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>(defaultTheme);

  useEffect(() => {
    const read = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
        if (saved === "light" || saved === "dark" || saved === "system") setChoice(saved);
      } catch {
        // Storage unavailable (private mode): keep the site default.
      }
    };
    read();
    // Keep "system" in step with the OS setting while the page is open.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      let current: ThemeChoice = defaultTheme;
      try {
        current = (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? defaultTheme;
      } catch {}
      if (current === "system") apply("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [defaultTheme]);

  function choose(next: ThemeChoice) {
    setChoice(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    apply(next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className,
        )}
        aria-label="Change theme"
      >
        <Sun className="size-4.5 dark:hidden" />
        <Moon className="hidden size-4.5 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-36">
        {OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => choose(option.value)}
            className={cn(choice === option.value && "bg-muted font-medium")}
          >
            <option.icon />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
