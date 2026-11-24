import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailsForm } from "@/components/admin/product/details-form";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Edit product" };

type Faq = { q: string; a: string };

function parseFaqs(value: unknown): Faq[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Faq => !!item && typeof item === "object" && typeof (item as Faq).q === "string" && typeof (item as Faq).a === "string")
    .map((item) => ({ q: item.q, a: item.a }));
}

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;

  const [product, categories, instructors] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { instructors: { select: { id: true } } } }),
    db.category.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.instructor.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true, title: true } }),
  ]);
  if (!product) notFound();

  return (
    <DetailsForm
      // Remount when the product changes so the form never shows another product's values.
      key={product.id}
      productId={product.id}
      type={product.type}
      categories={categories}
      instructors={instructors}
      initial={{
        title: product.title,
        slug: product.slug,
        tagline: product.tagline ?? "",
        description: product.description ?? "",
        thumbnailUrl: product.thumbnailUrl ?? "",
        categoryId: product.categoryId ?? "",
        instructorIds: product.instructors.map((instructor) => instructor.id),
        level: product.level,
        language: product.language,
        durationLabel: product.durationLabel ?? "",
        tags: product.tags,
        outcomes: product.outcomes,
        requirements: product.requirements,
        audience: product.audience,
        faqs: parseFaqs(product.faqs),
        version: product.version ?? "",
        platform: product.platform ?? "",
      }}
    />
  );
}
