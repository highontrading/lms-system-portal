import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Award, CircleCheckBig, KeyRound, UserPlus, Users, type LucideIcon } from "lucide-react";
import { DailyBars } from "@/components/admin/charts/daily-bars";
import { DemoBanner } from "@/components/admin/people/demo-banner";
import { ProductTypeBadge } from "@/components/product/visuals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, ProgressBar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { ENROLLMENT_SOURCE_LABELS } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { getDashboardData } from "@/server/admin/analytics";
import { requireStaff } from "@/server/auth/guards";
import { hasDemoContent } from "@/server/demo";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Dashboard" };

function StatTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 font-display text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

export default async function AdminDashboardPage() {
  const [{ user }, { general }] = await Promise.all([requireStaff("admin.access"), getSettings()]);
  const [data, demo] = await Promise.all([getDashboardData(general.timezone), hasDemoContent()]);
  const { totals } = data;
  const number = (value: number) => value.toLocaleString(general.locale);
  const now = new Date();
  const canViewStudents = can(user.role, "students.view");
  const sum = (points: { value: number }[]) => points.reduce((total, point) => total + point.value, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="How your academy is doing: who has access, who is learning, and what they are finishing."
      />

      {demo ? <DemoBanner canRemove={can(user.role, "settings.manage")} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <StatTile icon={Users} label="Students" value={number(totals.students)} detail="Total accounts" />
        <StatTile icon={UserPlus} label="New students" value={number(totals.newStudents)} detail="Last 30 days" />
        <StatTile icon={Activity} label="Active learners" value={number(totals.activeLearners)} detail="Last 7 days" />
        <StatTile icon={KeyRound} label="Active access" value={number(totals.activeEnrollments)} detail="Products unlocked" />
        <StatTile
          icon={CircleCheckBig}
          label="Completion rate"
          value={totals.completionRate === null ? "—" : `${totals.completionRate}%`}
          detail={
            totals.completionRate === null
              ? "No lesson-based access yet"
              : `${number(totals.completedEnrollments)} finished`
          }
        />
        <StatTile icon={Award} label="Certificates" value={number(totals.certificates)} detail="Issued so far" />
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Access granted per day</CardTitle>
            <CardDescription>
              {number(sum(data.grantsSeries))} in the last 30 days — purchases, imports and manual grants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DailyBars
              data={data.grantsSeries}
              title="Access granted per day"
              unit={{ one: "access grant", many: "access grants" }}
              locale={general.locale}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Lessons completed per day</CardTitle>
            <CardDescription>{number(sum(data.lessonsSeries))} in the last 30 days, across all students.</CardDescription>
          </CardHeader>
          <CardContent>
            <DailyBars
              data={data.lessonsSeries}
              title="Lessons completed per day"
              unit={{ one: "lesson", many: "lessons" }}
              locale={general.locale}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent access grants</CardTitle>
              <CardDescription>The latest people to get a product.</CardDescription>
            </div>
            {can(user.role, "enrollments.manage") ? (
              <Link href="/admin/enrollments" className="shrink-0 text-[0.8125rem] font-medium text-primary-text hover:underline">
                View all
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="pt-3">
            {data.recentGrants.length === 0 ? (
              <EmptyState compact icon={<KeyRound />} title="No access granted yet" description="Grants from purchases, imports and your team appear here." />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentGrants.map((grant) => {
                  const row = (
                    <>
                      <Avatar name={grant.user.name} src={grant.user.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{grant.user.name}</span>
                        <span className="block truncate text-[0.8125rem] text-muted-foreground">
                          {grant.product.title} · {ENROLLMENT_SOURCE_LABELS[grant.source]}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                        {timeAgo(grant.createdAt, now)}
                      </span>
                    </>
                  );
                  return (
                    <li key={grant.id}>
                      {canViewStudents ? (
                        <Link
                          href={`/admin/students/${grant.user.id}`}
                          className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted"
                        >
                          {row}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 py-2.5">{row}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>By students with active access, with their average progress.</CardDescription>
          </CardHeader>
          <CardContent className="pt-3">
            {data.topProducts.length === 0 ? (
              <EmptyState compact icon={<Users />} title="Nothing to rank yet" description="Products appear here once students have access to them." />
            ) : (
              <ul className="divide-y divide-border">
                {data.topProducts.map((product) => (
                  <li key={product.id} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.title}</p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <ProductTypeBadge type={product.type} size="sm" />
                        {product.averageProgress === null ? (
                          <span className="text-xs text-muted-foreground">No lessons to track</span>
                        ) : (
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            <ProgressBar value={product.averageProgress} size="sm" className="max-w-28" label="Average progress" />
                            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                              {product.averageProgress}% avg
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg leading-none font-semibold tabular-nums">{number(product.students)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">student{product.students === 1 ? "" : "s"}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
