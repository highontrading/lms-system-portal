"use server";

import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { assignableRoles, ROLE_LABELS } from "@/lib/permissions";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { revokeUserSessions } from "@/server/auth/session";
import { issueToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { notify } from "@/server/notifications";
import { loadSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

const STAFF_ROLES = ["OWNER", "ADMIN", "INSTRUCTOR", "SUPPORT"] as const;

async function assertNotLastOwner(userId: string) {
  const otherOwners = await db.user.count({ where: { role: "OWNER", status: "ACTIVE", id: { not: userId } } });
  if (otherOwners === 0) throw new ActionError("There must always be at least one owner. Make someone else an owner first.");
}

/** Rules shared by every role change: who may assign what, and to whom. */
async function assertCanChange(actor: { id: string; role: Role }, target: { id: string; role: Role }, nextRole: Role) {
  if (actor.id === target.id) throw new ActionError("You can't change your own role. Ask another owner to do it.");
  const allowed = assignableRoles(actor.role);
  if (!allowed.includes(nextRole)) throw new ActionError(`Your role can't assign ${ROLE_LABELS[nextRole]} access.`);
  if (target.role === "OWNER" && actor.role !== "OWNER") throw new ActionError("Only an owner can change another owner.");
  if (target.role === "OWNER" && nextRole !== "OWNER") await assertNotLastOwner(target.id);
}

export const inviteTeamMember = staffAction(
  "team.manage",
  z.object({
    name: z.string().trim().min(2, "Enter their name").max(80),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
    role: z.enum(STAFF_ROLES),
  }),
  async ({ name, email, role }, ctx) => {
    if (!assignableRoles(ctx.user.role).includes(role)) {
      throw new ActionError(`Your role can't assign ${ROLE_LABELS[role]} access.`, { role: "Not allowed for your role" });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.role !== "STUDENT") {
      throw new ActionError("That person is already on the team. Change their role in the list instead.", {
        email: "Already a team member",
      });
    }
    if (existing?.status === "SUSPENDED") {
      throw new ActionError("That account is suspended. Reactivate it under Students first.", { email: "Account suspended" });
    }

    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { role } })
      : await db.user.create({ data: { name, email, role } });

    const { general } = await loadSettings();
    if (!user.passwordHash) {
      // New to the academy (or never set a password): a one-time link to sign in and choose one.
      const { token } = await issueToken({ type: "INVITE", email, userId: user.id, ttlMinutes: 7 * 24 * 60, keepExisting: true });
      await sendEmail(
        email,
        "team-invite",
        emails.teamInvite({
          name: user.name,
          role: ROLE_LABELS[role],
          siteName: general.siteName,
          url: absoluteUrl(`/welcome/${token}?next=${encodeURIComponent("/admin")}`),
        }),
      );
    } else {
      await sendEmail(email, "team-added", {
        subject: `You've been added to the ${general.siteName} team`,
        heading: "You're on the team",
        paragraphs: [`Hi ${user.name.split(/\s+/)[0]}, your account now has ${ROLE_LABELS[role]} access to ${general.siteName}. Sign in as usual to open the admin panel.`],
        button: { label: "Open the admin panel", url: absoluteUrl("/login?next=%2Fadmin") },
      });
      await notify(user.id, { type: "system", title: `You now have ${ROLE_LABELS[role]} access`, href: "/admin" });
    }

    await audit(ctx.user, "team.invite", `Added ${email} to the team as ${ROLE_LABELS[role]}`, { entityType: "user", entityId: user.id });
    return { id: user.id, invited: !user.passwordHash };
  },
);

export const changeTeamRole = staffAction(
  "team.manage",
  z.object({ userId: z.string().min(1), role: z.enum(STAFF_ROLES) }),
  async ({ userId, role }, ctx) => {
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
    if (!target || target.role === "STUDENT") throw new ActionError("That person is no longer on the team.");
    if (target.role === role) return { changed: false };
    await assertCanChange(ctx.user, target, role);

    await db.user.update({ where: { id: userId }, data: { role } });
    await audit(ctx.user, "team.role", `Changed ${target.email} from ${ROLE_LABELS[target.role]} to ${ROLE_LABELS[role]}`, {
      entityType: "user",
      entityId: userId,
    });
    return { changed: true };
  },
);

export const removeTeamMember = staffAction(
  "team.manage",
  z.object({ userId: z.string().min(1) }),
  async ({ userId }, ctx) => {
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true } });
    if (!target || target.role === "STUDENT") return { removed: true as const };
    await assertCanChange(ctx.user, target, "STUDENT");

    await db.user.update({ where: { id: userId }, data: { role: "STUDENT" } });
    // Anything they have open in the admin panel stops working straight away.
    await revokeUserSessions(userId);
    await audit(ctx.user, "team.remove", `Removed ${target.email} from the team`, { entityType: "user", entityId: userId });
    return { removed: true as const };
  },
);
