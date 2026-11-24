import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { EditorActions } from "@/components/admin/product/editor-actions";
import { EditorTabs } from "@/components/admin/product/editor-tabs";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { Badge } from "@/components/ui/badge";
import { PRODUCT_STATUS_LABELS, VISIBILITY_LABELS } from "@/lib/labels";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

// Loads the product for the header; the tab pages below stream behind their own loading states.
export const instant = false;

const STATUS_VARIANTS = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" } as const;

export default async function ProductEditorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireStaff("products.manage");
  const { id } = await params;
  const product = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      status: true,
      visibility: true,
      thumbnailUrl: true,
      price: true,
      _count: { select: { enrollments: true } },
    },
  });
  if (!product) notFound();

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-3 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Products
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <ProductCover
            type={product.type}
            thumbnailUrl={product.thumbnailUrl}
            seed={product.slug}
            className="w-20 shrink-0 rounded-md sm:w-24"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
              {product.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <ProductTypeBadge type={product.type} size="sm" />
              <Badge variant={STATUS_VARIANTS[product.status]} size="sm">
                {PRODUCT_STATUS_LABELS[product.status]}
              </Badge>
              {product.visibility !== "PUBLIC" ? (
                <Badge variant="outline" size="sm">
                  {VISIBILITY_LABELS[product.visibility]}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <EditorActions
          product={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            status: product.status,
            visibility: product.visibility,
            enrollmentCount: product._count.enrollments,
            // A published, non-private product without a price can be joined for free by any signed-in visitor.
            freeToJoin: product.visibility !== "PRIVATE" && product.price === 0,
          }}
        />
      </div>

      <EditorTabs productId={product.id} type={product.type} />
      <div className="pt-6">{children}</div>
    </>
  );
}
