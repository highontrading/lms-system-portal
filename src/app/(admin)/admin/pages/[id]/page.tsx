import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageEditor } from "@/components/admin/settings/page-editor";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("pages.manage");
  const { id } = await params;
  const page = id === "new" ? null : await db.page.findUnique({ where: { id } });
  if (id !== "new" && !page) notFound();

  return (
    <div>
      <PageHeader
        title={page ? page.title : "New page"}
        description={page ? `Public address: /${page.slug}` : "Write a content page for your site."}
        back={{ href: "/admin/pages", label: "Pages" }}
      />
      <PageEditor
        key={page?.id ?? "new"}
        page={
          page
            ? {
                id: page.id,
                title: page.title,
                slug: page.slug,
                body: page.body,
                seoDescription: page.seoDescription ?? "",
                isPublished: page.isPublished,
                showInFooter: page.showInFooter,
              }
            : null
        }
      />
    </div>
  );
}
