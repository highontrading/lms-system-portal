import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SettingsForm } from "@/components/admin/product/settings-form";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Product settings" };

export default async function ProductSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      status: true,
      visibility: true,
      featured: true,
      position: true,
      seoTitle: true,
      seoDescription: true,
      _count: { select: { enrollments: true } },
    },
  });
  if (!product) notFound();

  return (
    <SettingsForm
      key={product.id}
      productId={product.id}
      title={product.title}
      status={product.status}
      enrollmentCount={product._count.enrollments}
      initial={{
        visibility: product.visibility,
        featured: product.featured,
        position: String(product.position),
        seoTitle: product.seoTitle ?? "",
        seoDescription: product.seoDescription ?? "",
      }}
    />
  );
}
