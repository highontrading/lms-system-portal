import type { Metadata } from "next";
import Link from "next/link";
import { Award, KeyRound } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { EnrollmentSource } from "@/generated/prisma/enums";
import { GrantByEmailDialog } from "@/components/admin/people/access-forms";
import { CsvImportDialog } from "@/components/admin/people/csv-import";
import { EnrollmentMenu } from "@/components/admin/people/enrollment-menu";
import { ProductTypeBadge } from "@/components/product/visuals";
import { StatusDot } from "@/components/ui/badge";
import { ParamSelect, SearchInput } from "@/components/ui/controls";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage, Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { dayKey } from "@/lib/dates";
import { ENROLLMENT_SOURCE_LABELS } from "@/lib/labels";
import { firstParam, formatDate, type SearchParams } from "@/lib/utils";
import { accessStatus, productOptions } from "@/server/admin/people";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Access" };

const PAGE_SIZE = 25;
const SOURCES = Object.keys(ENROLLMENT_SOURCE_LABELS) as EnrollmentSource[];
const STATUS_TONE = { active: "success", expired: "warning", revoked: "danger" } as const;
const STATUS_LABEL = { active: "Active", expired: "Expired", revoked: "Revoked" } as const;

export default async function AccessPage({ searchParams }: { searchParams: SearchParams }) {
  const [, params, { general }] = await Promise.all([requireStaff("enrollments.manage"), searchParams, getSettings()]);
  const q = firstParam(params.q)?.trim() ?? "";
  const productId = firstParam(params.product) ?? "";
  const status = firstParam(params.status) ?? "";
  const source = SOURCES.find((value) => value === firstParam(params.source)) ?? "";
  const page = parsePage(params.page);
  const now = new Date();

  const where: Prisma.EnrollmentWhereInput = {
    ...(q
      ? {
          user: {
            OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }],
          },
        }
      : {}),
    ...(productId ? { productId } : {}),
    ...(source ? { source } : {}),
    ...(status === "revoked" ? { status: "REVOKED" } : {}),
    ...(status === "active" ? { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } : {}),
    ...(status === "expired" ? { status: "ACTIVE", expiresAt: { lte: now } } : {}),
  };

  const [enrollments, total, products] = await Promise.all([
    db.enrollment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: {
          select: {
            id: true,
            title: true,
            type: true,
            _count: { select: { lessons: { where: { isPublished: true } } } },
          },
        },
      },
    }),
    db.enrollment.count({ where }),
    productOptions(),
  ]);

  const dateOptions = { locale: general.locale, timeZone: general.timezone };
  const filtered = !!(q || productId || status || source);

  return (
    <>
      <PageHeader
        title="Access"
        description="Who can open what. Grant access by email, import a list of buyers, or change and revoke existing access."
        actions={
          <>
            <CsvImportDialog products={products} />
            <GrantByEmailDialog products={products} />
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <SearchInput placeholder="Search by student name or email…" />
        <ParamSelect
          param="product"
          label="Filter by product"
          options={[{ value: "", label: "All products" }, ...products.map((product) => ({ value: product.id, label: product.title }))]}
        />
        <ParamSelect
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "Any status" },
            { value: "active", label: "Active" },
            { value: "expired", label: "Expired" },
            { value: "revoked", label: "Revoked" },
          ]}
        />
        <ParamSelect
          param="source"
          label="Filter by source"
          options={[{ value: "", label: "Any source" }, ...SOURCES.map((value) => ({ value, label: ENROLLMENT_SOURCE_LABELS[value] }))]}
        />
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={<KeyRound />}
          title={filtered ? "Nothing matches these filters" : "No access granted yet"}
          description={
            filtered
              ? "Try a different search or clear a filter."
              : "Grant access by email, import a CSV of buyers, or connect your sales platform so purchases grant access automatically."
          }
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Student</Th>
                  <Th>Product</Th>
                  <Th>Source</Th>
                  <Th>Granted</Th>
                  <Th>Access until</Th>
                  <Th>Progress</Th>
                  <Th>Status</Th>
                  <Th className="w-10" aria-label="Actions" />
                </tr>
              </THead>
              <TBody>
                {enrollments.map((enrollment) => {
                  const rowStatus = accessStatus(enrollment, now);
                  const hasLessons = enrollment.product._count.lessons > 0;
                  return (
                    <Tr key={enrollment.id}>
                      <Td>
                        <Link href={`/admin/students/${enrollment.user.id}`} className="block max-w-44 hover:text-primary-text">
                          <span className="block truncate font-medium">{enrollment.user.name}</span>
                          <span className="block truncate text-[0.8125rem] text-muted-foreground">{enrollment.user.email}</span>
                        </Link>
                      </Td>
                      <Td>
                        <div className="flex max-w-48 flex-col gap-1">
                          <span className="truncate font-medium">{enrollment.product.title}</span>
                          <ProductTypeBadge type={enrollment.product.type} size="sm" />
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{ENROLLMENT_SOURCE_LABELS[enrollment.source]}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">{formatDate(enrollment.createdAt, dateOptions)}</Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {enrollment.expiresAt ? formatDate(enrollment.expiresAt, dateOptions) : "Lifetime"}
                      </Td>
                      <Td>
                        {hasLessons ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={enrollment.progressPercent} size="sm" className="w-12" />
                            <span className="text-[0.8125rem] tabular-nums text-muted-foreground">{enrollment.progressPercent}%</span>
                            {enrollment.completedAt ? <Award className="size-4 text-success" aria-label="Completed" /> : null}
                          </div>
                        ) : (
                          <span className="text-[0.8125rem] text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td>
                        <StatusDot tone={STATUS_TONE[rowStatus]}>{STATUS_LABEL[rowStatus]}</StatusDot>
                      </Td>
                      <Td className="text-right">
                        <EnrollmentMenu
                          enrollment={{
                            id: enrollment.id,
                            status: rowStatus,
                            expiry: enrollment.expiresAt ? dayKey(enrollment.expiresAt, general.timezone) : "lifetime",
                            productTitle: enrollment.product.title,
                            studentName: enrollment.user.name,
                            hasLessons,
                          }}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableCard>
          <Pagination
            className="mt-4"
            basePath="/admin/enrollments"
            params={{ q: q || undefined, product: productId || undefined, status: status || undefined, source: source || undefined }}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            noun="access record"
          />
        </>
      )}
    </>
  );
}
