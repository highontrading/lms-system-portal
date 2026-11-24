import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { ProductStatus, ProductType } from "@/generated/prisma/enums";
import { ProductCover, ProductTypeBadge } from "@/components/product/visuals";
import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ParamSelect, SearchInput } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage, Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { PRODUCT_STATUS_LABELS, PRODUCT_TYPE_PLURALS, PRODUCT_TYPES } from "@/lib/labels";
import { firstParam, formatDate, type SearchParams } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 20;

const STATUS_TONES = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "warning" } as const;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireStaff("products.manage");
  const [params, { general }] = await Promise.all([searchParams, getSettings()]);

  const q = firstParam(params.q)?.trim() ?? "";
  const typeParam = firstParam(params.type) ?? "";
  const statusParam = firstParam(params.status) ?? "";
  const type = typeParam in ProductType ? (typeParam as ProductType) : null;
  const status = statusParam in ProductStatus ? (statusParam as ProductStatus) : null;
  const page = parsePage(params.page);

  const where: Prisma.ProductWhereInput = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
  };

  const [products, total, overall] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        type: true,
        status: true,
        visibility: true,
        thumbnailUrl: true,
        updatedAt: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.product.count({ where }),
    db.product.count(),
  ]);

  const filtered = Boolean(q || type || status);

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything students can get access to: courses, workshops, agents, workflows, digital products and bundles."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <Plus /> New product
            </Link>
          </Button>
        }
      />

      {overall === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Create your first product"
          description="Add a course, a workshop, an agent or a workflow. Once it's published you can give students access to it."
          action={
            <Button asChild>
              <Link href="/admin/products/new">
                <Plus /> New product
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput placeholder="Search products…" />
            <ParamSelect
              param="type"
              label="Filter by type"
              options={[{ value: "", label: "All types" }, ...PRODUCT_TYPES.map((value) => ({ value, label: PRODUCT_TYPE_PLURALS[value] }))]}
            />
            <ParamSelect
              param="status"
              label="Filter by status"
              options={[
                { value: "", label: "Any status" },
                ...Object.values(ProductStatus).map((value) => ({ value, label: PRODUCT_STATUS_LABELS[value] })),
              ]}
            />
          </div>

          {products.length === 0 ? (
            <EmptyState
              compact
              icon={<Package />}
              title="No products match"
              description={filtered ? "Try a different search or clear the filters." : undefined}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/admin/products">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <TableCard>
              <Table>
                <THead>
                  <tr>
                    <Th>Product</Th>
                    <Th className="hidden sm:table-cell">Type</Th>
                    <Th>Status</Th>
                    <Th className="hidden text-right md:table-cell">Students</Th>
                    <Th className="hidden lg:table-cell">Updated</Th>
                  </tr>
                </THead>
                <TBody>
                  {products.map((product) => (
                    <Tr key={product.id}>
                      <Td className="max-w-[16rem] sm:max-w-md">
                        <Link href={`/admin/products/${product.id}`} className="group flex items-center gap-3">
                          <ProductCover
                            type={product.type}
                            thumbnailUrl={product.thumbnailUrl}
                            seed={product.slug}
                            className="w-16 shrink-0 rounded-md"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium group-hover:text-primary-text">{product.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">/{product.slug}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        <ProductTypeBadge type={product.type} size="sm" />
                      </Td>
                      <Td>
                        <StatusDot tone={STATUS_TONES[product.status]}>
                          {PRODUCT_STATUS_LABELS[product.status]}
                          {product.status === "PUBLISHED" && product.visibility !== "PUBLIC" ? (
                            <span className="font-normal text-muted-foreground"> · {product.visibility.toLowerCase()}</span>
                          ) : null}
                        </StatusDot>
                      </Td>
                      <Td className="hidden text-right tabular-nums md:table-cell">
                        {product._count.enrollments.toLocaleString("en")}
                      </Td>
                      <Td className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                        {formatDate(product.updatedAt, { locale: general.locale, timeZone: general.timezone })}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableCard>
          )}

          <Pagination
            basePath="/admin/products"
            params={{ q: q || undefined, type: type ?? undefined, status: status ?? undefined }}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            noun="product"
          />
        </div>
      )}
    </>
  );
}
