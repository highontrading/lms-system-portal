import type { Metadata } from "next";
import { Megaphone, Pin } from "lucide-react";
import { AnnouncementEditorButton, DeleteAnnouncementButton } from "@/components/admin/settings/announcement-editor";
import { Badge, StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage, Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { firstParam, formatDate, stripHtml, truncate, type SearchParams } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Announcements" };

const PAGE_SIZE = 20;

export default async function AnnouncementsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("announcements.manage");
  const params = await searchParams;
  const page = parsePage(firstParam(params.page));

  const [announcements, total, products, { general }] = await Promise.all([
    db.announcement.findMany({
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { product: { select: { title: true } } },
    }),
    db.announcement.count(),
    db.product.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    getSettings(),
  ]);
  const dates = { locale: general.locale, timeZone: general.timezone };

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Tell students what's new. Published announcements appear on their dashboard and in their notifications."
        actions={<AnnouncementEditorButton products={products} />}
      />

      {total === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No announcements yet"
          description="Share a welcome note, a schedule change or a new release with your students."
          action={<AnnouncementEditorButton products={products} />}
        />
      ) : (
        <div className="grid gap-4">
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Announcement</Th>
                  <Th>Audience</Th>
                  <Th>Status</Th>
                  <Th>Email</Th>
                  <Th aria-label="Actions" />
                </tr>
              </THead>
              <TBody>
                {announcements.map((announcement) => (
                  <Tr key={announcement.id}>
                    <Td className="max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{announcement.title}</span>
                        {announcement.isPinned ? (
                          <Badge variant="primary" size="sm">
                            <Pin />
                            Pinned
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[0.8125rem] text-muted-foreground">
                        {truncate(stripHtml(announcement.body), 110)}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {announcement.audience === "PRODUCT" ? (announcement.product?.title ?? "One product") : "Everyone"}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {announcement.publishedAt ? (
                        <StatusDot tone="success">Published {formatDate(announcement.publishedAt, { ...dates, style: "short" })}</StatusDot>
                      ) : (
                        <StatusDot tone="neutral">Draft</StatusDot>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{announcement.emailedAt ? "Emailed" : "—"}</Td>
                    <Td>
                      <div className="flex items-center justify-end gap-0.5">
                        <AnnouncementEditorButton
                          products={products}
                          announcement={{
                            id: announcement.id,
                            title: announcement.title,
                            body: announcement.body,
                            audience: announcement.audience,
                            productId: announcement.productId,
                            isPinned: announcement.isPinned,
                            published: !!announcement.publishedAt,
                            emailed: !!announcement.emailedAt,
                          }}
                        />
                        <DeleteAnnouncementButton id={announcement.id} title={announcement.title} />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
          <Pagination basePath="/admin/announcements" page={page} pageSize={PAGE_SIZE} total={total} noun="announcement" />
        </div>
      )}
    </div>
  );
}
