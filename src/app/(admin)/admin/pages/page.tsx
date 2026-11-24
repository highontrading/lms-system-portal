import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FileText, Plus } from "lucide-react";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesPage() {
  await requireStaff("pages.manage");
  const [pages, { general }] = await Promise.all([
    db.page.findMany({ orderBy: [{ position: "asc" }, { title: "asc" }] }),
    getSettings(),
  ]);

  const newButton = (
    <Button asChild>
      <Link href="/admin/pages/new">
        <Plus />
        New page
      </Link>
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Simple content pages such as About, Terms and Privacy. Published pages are public at /their-address."
        actions={newButton}
      />
      {pages.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="No pages yet"
          description="Add your terms, privacy policy or an About page."
          action={newButton}
        />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <tr>
                <Th>Page</Th>
                <Th>Address</Th>
                <Th>Status</Th>
                <Th>Footer</Th>
                <Th>Updated</Th>
                <Th aria-label="Actions" />
              </tr>
            </THead>
            <TBody>
              {pages.map((page) => (
                <Tr key={page.id}>
                  <Td>
                    <Link href={`/admin/pages/${page.id}`} className="font-medium hover:text-primary-text hover:underline">
                      {page.title}
                    </Link>
                  </Td>
                  <Td>
                    <code className="font-mono text-[0.8125rem] text-muted-foreground">/{page.slug}</code>
                  </Td>
                  <Td>
                    {page.isPublished ? <StatusDot tone="success">Published</StatusDot> : <StatusDot tone="neutral">Draft</StatusDot>}
                  </Td>
                  <Td className="text-muted-foreground">{page.showInFooter ? "Shown" : "Hidden"}</Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {formatDate(page.updatedAt, { locale: general.locale, timeZone: general.timezone })}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      {page.isPublished ? (
                        <Button asChild variant="ghost" size="icon-sm">
                          <Link href={`/${page.slug}`} target="_blank" aria-label={`View ${page.title}`}>
                            <ExternalLink />
                          </Link>
                        </Button>
                      ) : null}
                      <Button asChild variant="secondary" size="xs">
                        <Link href={`/admin/pages/${page.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}
