import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CurriculumBuilder } from "@/components/admin/content/curriculum-builder";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Content" };

export default async function CurriculumPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      sections: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          dripDays: true,
          lessons: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, type: true, isPublished: true, isPreview: true, durationSeconds: true },
          },
        },
      },
    },
  });
  if (!product) notFound();

  // Remount the builder whenever the saved content changes so its local ordering never goes stale.
  const signature = JSON.stringify(
    product.sections.map((section) => [
      section.id,
      section.title,
      section.dripDays,
      section.lessons.map((lesson) => [lesson.id, lesson.title, lesson.isPublished, lesson.isPreview, lesson.durationSeconds]),
    ]),
  );

  return <CurriculumBuilder key={signature} productId={product.id} sections={product.sections} />;
}
