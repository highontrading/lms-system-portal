import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BookOpenCheck, KeyRound, MailCheck, MailWarning } from "lucide-react";
import { GrantAccessDialog } from "@/components/admin/people/access-forms";
import { EnrollmentMenu } from "@/components/admin/people/enrollment-menu";
import { StudentAccountActions, StudentProfileForm } from "@/components/admin/people/student-forms";
import { ProductTypeBadge } from "@/components/product/visuals";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, ProgressBar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { ENROLLMENT_SOURCE_LABELS } from "@/lib/labels";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { dayKey } from "@/lib/dates";
import { formatDate, timeAgo } from "@/lib/utils";
import { accessStatus, productOptions } from "@/server/admin/people";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Student" };

const STATUS_TONE = { active: "success", expired: "warning", revoked: "danger" } as const;
const STATUS_LABEL = { active: "Active", expired: "Expired", revoked: "Revoked" } as const;

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ user: staff }, { id }, { general }] = await Promise.all([
    requireStaff("students.view"),
    params,
    getSettings(),
  ]);

  const student = await db.user.findUnique({
    where: { id },
    include: {
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          product: {
            select: {
              id: true,
              title: true,
              type: true,
              slug: true,
              _count: { select: { lessons: { where: { isPublished: true } } } },
            },
          },
        },
      },
      certificates: { orderBy: { issuedAt: "desc" }, take: 10 },
      lessonProgress: {
        where: { completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 8,
        include: { lesson: { select: { title: true, product: { select: { title: true } } } } },
      },
    },
  });
  if (!student) notFound();

  const canManage = can(staff.role, "students.manage");
  const canGrant = can(staff.role, "enrollments.manage");
  const products = canGrant ? await productOptions() : [];
  const now = new Date();
  const dateOptions = { locale: general.locale, timeZone: general.timezone };
  const activeCount = student.enrollments.filter((enrollment) => accessStatus(enrollment, now) === "active").length;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/students", label: "Students" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={student.name} src={student.avatarUrl} size="lg" />
            <span className="min-w-0">
              <span className="block truncate">{student.name}</span>
              <span className="block truncate font-sans text-sm font-normal tracking-normal text-muted-foreground">
                {student.email}
              </span>
            </span>
          </span>
        }
        actions={
          canGrant ? (
            <GrantAccessDialog
              userId={student.id}
              studentName={student.name}
              products={products}
              ownedProductIds={student.enrollments
                .filter((enrollment) => accessStatus(enrollment, now) === "active")
                .map((enrollment) => enrollment.productId)}
              buttonProps={{ size: "md" }}
            />
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground">
        <StatusDot tone={student.status === "ACTIVE" ? "success" : "danger"}>
          {student.status === "ACTIVE" ? "Active" : "Suspended"}
        </StatusDot>
        {student.role !== "STUDENT" ? <Badge variant="primary">{ROLE_LABELS[student.role]}</Badge> : null}
        <span className="inline-flex items-center gap-1.5">
          {student.emailVerifiedAt ? (
            <MailCheck className="size-4 text-success" />
          ) : (
            <MailWarning className="size-4 text-warning" />
          )}
          {student.emailVerifiedAt ? "Email confirmed" : "Email not confirmed"}
        </span>
        <span>Joined {formatDate(student.createdAt, dateOptions)}</span>
        <span>
          {student.lastActiveAt
            ? `Last active ${timeAgo(student.lastActiveAt, now)}`
            : student.lastLoginAt
              ? `Last signed in ${timeAgo(student.lastLoginAt, now)}`
              : "Never signed in"}
        </span>
        <span>
          {activeCount} active product{activeCount === 1 ? "" : "s"}
        </span>
      </div>

      <section className="mb-6 min-w-0">
        <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Access</h2>
        {student.enrollments.length === 0 ? (
          <EmptyState
            compact
            icon={<KeyRound />}
            title="No access yet"
            description="Grant a product and it appears in this student's library straight away."
          />
        ) : (
          <TableCard>
            <Table>
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th>Source</Th>
                  <Th>Granted</Th>
                  <Th>Access until</Th>
                  <Th className="min-w-36">Progress</Th>
                  <Th>Status</Th>
                  {canGrant ? <Th className="w-10" aria-label="Actions" /> : null}
                </tr>
              </THead>
              <TBody>
                {student.enrollments.map((enrollment) => {
                  const status = accessStatus(enrollment, now);
                  const hasLessons = enrollment.product._count.lessons > 0;
                  return (
                    <Tr key={enrollment.id}>
                      <Td>
                        <div className="flex max-w-64 flex-col gap-1">
                          <Link
                            href={`/admin/products/${enrollment.product.id}`}
                            className="truncate font-medium hover:text-primary-text"
                          >
                            {enrollment.product.title}
                          </Link>
                          <ProductTypeBadge type={enrollment.product.type} size="sm" />
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {ENROLLMENT_SOURCE_LABELS[enrollment.source]}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {formatDate(enrollment.createdAt, dateOptions)}
                      </Td>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {enrollment.expiresAt ? formatDate(enrollment.expiresAt, dateOptions) : "Lifetime"}
                      </Td>
                      <Td>
                        {hasLessons ? (
                          <div className="flex items-center gap-2">
                            <ProgressBar value={enrollment.progressPercent} size="sm" className="w-20" />
                            <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
                              {enrollment.progressPercent}%
                            </span>
                            {enrollment.completedAt ? (
                              <Award className="size-4 text-success" aria-label="Completed" />
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[0.8125rem] text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td>
                        <StatusDot tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</StatusDot>
                      </Td>
                      {canGrant ? (
                        <Td className="text-right">
                          <EnrollmentMenu
                            enrollment={{
                              id: enrollment.id,
                              status,
                              expiry: enrollment.expiresAt
                                ? dayKey(enrollment.expiresAt, general.timezone)
                                : "lifetime",
                              productTitle: enrollment.product.title,
                              studentName: student.name,
                              hasLessons,
                            }}
                          />
                        </Td>
                      ) : null}
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableCard>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Recent activity</h2>
          {student.lessonProgress.length === 0 && student.certificates.length === 0 ? (
            <EmptyState
              compact
              icon={<BookOpenCheck />}
              title="Nothing yet"
              description="Completed lessons and certificates will show up here."
            />
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {student.certificates.map((certificate) => (
                  <li key={certificate.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success-soft text-success-text">
                      <Award className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">Certificate — {certificate.productTitle}</span>
                      <span className="block text-[0.8125rem] text-muted-foreground">
                        Issued {formatDate(certificate.issuedAt, dateOptions)} · {certificate.serial}
                      </span>
                    </span>
                    <Link
                      href={`/verify/${certificate.serial}`}
                      className="shrink-0 text-[0.8125rem] font-medium text-primary-text hover:underline"
                      target="_blank"
                    >
                      View
                    </Link>
                  </li>
                ))}
                {student.lessonProgress.map((progress) => (
                  <li key={progress.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-text">
                      <BookOpenCheck className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{progress.lesson.title}</span>
                      <span className="block truncate text-[0.8125rem] text-muted-foreground">
                        {progress.lesson.product.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.8125rem] whitespace-nowrap text-muted-foreground">
                      {progress.completedAt ? timeAgo(progress.completedAt, now) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Contact details and a private note for your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <StudentProfileForm
                canManage={canManage}
                student={{
                  id: student.id,
                  name: student.name,
                  email: student.email,
                  phone: student.phone,
                  adminNote: student.adminNote,
                }}
              />
            </CardContent>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Help this student get in, or stop them signing in.</CardDescription>
              </CardHeader>
              <CardContent>
                <StudentAccountActions
                  student={{
                    id: student.id,
                    name: student.name,
                    status: student.status,
                    isStudent: student.role === "STUDENT",
                  }}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
