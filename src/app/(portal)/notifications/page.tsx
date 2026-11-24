import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { MarkAllReadButton, NotificationList } from "@/components/portal/account/notification-list";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/table";
import { timeAgo, type SearchParams } from "@/lib/utils";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireUser();
  const page = parsePage((await searchParams).page);

  const [items, total, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.notification.count({ where: { userId: user.id } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={total > 0 ? <MarkAllReadButton disabled={unread === 0} /> : null}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<BellOff />}
          title="No notifications yet"
          description="New access, live session reminders, updates and announcements will show up here."
        />
      ) : (
        <>
          <NotificationList
            items={items.map((item) => ({
              id: item.id,
              type: item.type,
              title: item.title,
              body: item.body,
              href: item.href,
              read: !!item.readAt,
              when: timeAgo(item.createdAt, now),
            }))}
          />
          <Pagination basePath="/notifications" page={page} pageSize={PAGE_SIZE} total={total} noun="notification" className="mt-5" />
        </>
      )}
    </div>
  );
}
