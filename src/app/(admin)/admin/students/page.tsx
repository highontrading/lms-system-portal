import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AddStudentDialog } from "@/components/admin/people/access-forms";
import { StatusDot } from "@/components/ui/badge";
import { ParamSelect, SearchInput } from "@/components/ui/controls";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage, Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { can } from "@/lib/permissions";
import { firstParam, formatDate, timeAgo, type SearchParams } from "@/lib/utils";
import { productOptions } from "@/server/admin/people";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Students" };

const PAGE_SIZE = 25;

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ user: staff }, params, { general }] = await Promise.all([requireStaff("students.view"), searchParams, getSettings()]);
  const q = firstParam(params.q)?.trim() ?? "";
  const status = firstParam(params.status) ?? "";
  const page = parsePage(params.page);

  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : {}),
    ...(status === "active" ? { status: "ACTIVE" } : {}),
    ...(status === "suspended" ? { status: "SUSPENDED" } : {}),
    ...(status === "never" ? { lastLoginAt: null } : {}),
  };

  const canManage = can(staff.role, "students.manage");
  const [students, total, products] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        lastActiveAt: true,
        lastLoginAt: true,
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    db.user.count({ where }),
    canManage ? productOptions() : Promise.resolve([]),
  ]);

  const now = new Date();
  const filtered = !!q || !!status;

  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone with an account. Open a student to see what they own, how far they've got, and to manage their access."
        actions={canManage ? <AddStudentDialog products={products} /> : null}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search by name or email…" />
        <ParamSelect
          param="status"
          label="Filter by status"
          options={[
            { value: "", label: "All students" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "never", label: "Never signed in" },
          ]}
        />
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={filtered ? "No students match" : "No students yet"}
          description={
            filtered
              ? "Try a different search or clear the filter."
              : "Students appear here when they sign up, when you add them, or when a purchase on another platform grants them access."
          }
        />
      ) : (
        <>
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Student</Th>
                  <Th className="text-right">Products</Th>
                  <Th>Last active</Th>
                  <Th>Joined</Th>
                  <Th>Status</Th>
                </tr>
              </THead>
              <TBody>
                {students.map((student) => (
                  <Tr key={student.id} className="relative">
                    <Td>
                      <Link href={`/admin/students/${student.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                        <Avatar name={student.name} src={student.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block max-w-56 truncate font-medium">{student.name}</span>
                          <span className="block max-w-56 truncate text-[0.8125rem] text-muted-foreground">{student.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">{student._count.enrollments}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {student.lastActiveAt ? timeAgo(student.lastActiveAt, now) : student.lastLoginAt ? timeAgo(student.lastLoginAt, now) : "Never signed in"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDate(student.createdAt, { locale: general.locale, timeZone: general.timezone })}
                    </Td>
                    <Td>
                      <StatusDot tone={student.status === "ACTIVE" ? "success" : "danger"}>
                        {student.status === "ACTIVE" ? "Active" : "Suspended"}
                      </StatusDot>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableCard>
          <Pagination
            className="mt-4"
            basePath="/admin/students"
            params={{ q: q || undefined, status: status || undefined }}
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            noun="student"
          />
        </>
      )}
    </>
  );
}
