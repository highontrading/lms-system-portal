import type { Metadata } from "next";
import { InstructorsManager } from "@/components/admin/product/instructors-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Instructors" };

export default async function InstructorsPage() {
  await requireStaff("products.manage");
  const instructors = await db.instructor.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return (
    <>
      <PageHeader title="Instructors" description="The people behind your products. Attach them to a product from its Details tab." />
      <InstructorsManager
        instructors={instructors.map((instructor) => ({
          id: instructor.id,
          name: instructor.name,
          title: instructor.title,
          bio: instructor.bio,
          avatarUrl: instructor.avatarUrl,
          website: instructor.website,
          twitter: instructor.twitter,
          linkedin: instructor.linkedin,
          youtube: instructor.youtube,
          instagram: instructor.instagram,
          productCount: instructor._count.products,
        }))}
      />
    </>
  );
}
