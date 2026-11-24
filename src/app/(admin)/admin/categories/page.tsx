import type { Metadata } from "next";
import { CategoriesManager } from "@/components/admin/product/categories-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireStaff("products.manage");
  const categories = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader title="Categories" description="Group products so students can browse the catalog by topic." />
      <CategoriesManager
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          position: category.position,
          productCount: category._count.products,
        }))}
      />
    </>
  );
}
