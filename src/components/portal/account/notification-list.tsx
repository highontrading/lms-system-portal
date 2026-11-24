"use client";

import { useRouter } from "next/navigation";
import {
  Award,
  Bell,
  CheckCheck,
  Library,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Radio,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { markAllNotificationsRead, markNotificationRead } from "@/server/portal/account-actions";

const ICONS: Record<string, LucideIcon> = {
  access: Library,
  announcement: Megaphone,
  certificate: Award,
  reply: MessageCircle,
  grade: CheckCheck,
  update: Sparkles,
  live: Radio,
  ticket: LifeBuoy,
  review: Star,
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  when: string;
};

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const markAll = useAction(markAllNotificationsRead, { success: "All caught up" });
  return (
    <Button variant="secondary" size="sm" disabled={disabled} loading={markAll.pending} onClick={() => markAll.run({})}>
      <CheckCheck />
      Mark all as read
    </Button>
  );
}

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const markRead = useAction(markNotificationRead);

  async function open(item: NotificationRow) {
    if (!item.read) await markRead.run({ id: item.id });
    // Only follow links that stay on this site.
    if (item.href && item.href.startsWith("/") && !item.href.startsWith("//")) router.push(item.href);
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? Bell;
        const interactive = !item.read || !!item.href;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!interactive}
              onClick={() => open(item)}
              className={cn(
                "flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors sm:px-5",
                interactive && "hover:bg-subtle",
                !item.read && "bg-primary-soft/45",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
                  item.read ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary-text",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm leading-snug", item.read ? "font-medium" : "font-semibold")}>{item.title}</span>
                {item.body ? <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{item.body}</span> : null}
                <span className="mt-1 block text-xs text-muted-foreground/80">{item.when}</span>
              </span>
              {!item.read ? (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
