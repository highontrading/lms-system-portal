import type { Metadata } from "next";
import { Megaphone, Pin } from "lucide-react";
import { RichText } from "@/components/content";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/table";
import { formatDate, timeAgo, type SearchParams } from "@/lib/utils";
import { isEnrollmentActive } from "@/server/access";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { visibleAnnouncementsWhere } from "@/server/portal/dashboard";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Announcements" };

const PAGE_SIZE = 10;

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await requireUser();
  const [params, { general }, enrollments] = await Promise.all([
    searchParams,
    getSettings(),
    db.enrollment.findMany({ where: { userId: user.id }, select: { productId: true, status: true, expiresAt: true } }),
  ]);
  const page = parsePage(params.page);
  const ownedIds = enrollments.filter((enrollment) => isEnrollmentActive(enrollment)).map((enrollment) => enrollment.productId);
  const where = visibleAnnouncementsWhere(ownedIds);

  const [items, total] = await Promise.all([
    db.announcement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { title: true } } },
    }),
    db.announcement.count({ where }),
  ]);
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" description="News and updates from the team." />

      {items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No announcements yet" description="When there's news, you'll find it here." />
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {item.isPinned ? (
                  <Badge variant="spark" size="sm">
                    <Pin aria-hidden />
                    Pinned
                  </Badge>
                ) : null}
                {item.product ? (
                  <Badge variant="primary" size="sm">
                    {item.product.title}
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm">
                    Everyone
                  </Badge>
                )}
                {item.publishedAt ? (
                  <span
                    className="text-xs text-muted-foreground"
                    title={formatDate(item.publishedAt, { locale: general.locale, timeZone: general.timezone, style: "long" })}
                  >
                    {timeAgo(item.publishedAt, now)}
                  </span>
                ) : null}
              </div>
              <h2 className="font-display text-lg leading-snug font-semibold tracking-tight">{item.title}</h2>
              <RichText html={item.body} small className="mt-3" />
            </Card>
          ))}
          <Pagination basePath="/announcements" page={page} pageSize={PAGE_SIZE} total={total} noun="announcement" className="mt-1" />
        </div>
      )}
    </div>
  );
}
