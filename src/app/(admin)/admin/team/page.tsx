import type { Metadata } from "next";
import { InviteTeamMemberButton, TeamMemberControls } from "@/components/admin/settings/team";
import type { Role } from "@/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { TEAM_ROLE_DESCRIPTIONS } from "@/components/admin/settings/team-roles";
import { assignableRoles, ROLE_LABELS } from "@/lib/permissions";
import { timeAgo } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Team" };

type StaffRole = Exclude<Role, "STUDENT">;
const ROLE_ORDER: StaffRole[] = ["OWNER", "ADMIN", "INSTRUCTOR", "SUPPORT"];

export default async function TeamPage() {
  const ctx = await requireStaff("team.manage");
  const members = await db.user.findMany({
    where: { role: { not: "STUDENT" } },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, lastActiveAt: true, passwordHash: true, status: true },
  });
  members.sort((a, b) => ROLE_ORDER.indexOf(a.role as StaffRole) - ROLE_ORDER.indexOf(b.role as StaffRole));

  const assignable = assignableRoles(ctx.user.role).filter((role): role is StaffRole => role !== "STUDENT");
  const now = new Date();

  return (
    <div className="grid gap-8">
      <PageHeader
        className="mb-0"
        title="Team"
        description="People who help you run the academy, and what each of them can do."
        actions={assignable.length > 0 ? <InviteTeamMemberButton roles={assignable} /> : null}
      />

      <TableCard>
        <Table>
          <THead>
            <tr>
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Last active</Th>
              <Th className="text-right">Manage</Th>
            </tr>
          </THead>
          <TBody>
            {members.map((member) => {
              const role = member.role as StaffRole;
              const locked =
                member.id === ctx.user.id
                  ? "This is you"
                  : role === "OWNER" && ctx.user.role !== "OWNER"
                    ? "Only owners can change owners"
                    : null;
              return (
                <Tr key={member.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="truncate text-[0.8125rem] text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Badge variant={role === "OWNER" ? "solid" : "primary"}>{ROLE_LABELS[role]}</Badge>
                      {!member.passwordHash ? <Badge variant="warning">Invite pending</Badge> : null}
                      {member.status === "SUSPENDED" ? <Badge variant="danger">Suspended</Badge> : null}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {member.lastActiveAt ? timeAgo(member.lastActiveAt, now) : "Never"}
                  </Td>
                  <Td className="text-right">
                    <TeamMemberControls userId={member.id} name={member.name} role={role} roles={assignable} locked={locked} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </TableCard>

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {ROLE_ORDER.map((role) => (
              <div key={role} className="rounded-lg border border-border bg-subtle/50 p-4">
                <dt className="font-medium">{ROLE_LABELS[role]}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{TEAM_ROLE_DESCRIPTIONS[role]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
