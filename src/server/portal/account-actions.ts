"use server";

import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import { ActionError, userAction } from "@/server/action";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions, type AuthContext } from "@/server/auth/session";
import { db } from "@/server/db";
import { rateLimit, retryMessage } from "@/server/rate-limit";

/** Staff viewing the portal as a student can look around, but never change that student's account. */
function assertOwnAccount(ctx: AuthContext) {
  if (ctx.impersonatorId) throw new ActionError("Account changes aren't available while viewing as a student.");
}

export const updateProfile = userAction(
  z.object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    headline: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    timezone: z.string().trim().max(60).optional(),
  }),
  async (input, ctx) => {
    assertOwnAccount(ctx);
    if (input.timezone && !isValidTimeZone(input.timezone)) {
      throw new ActionError("Please check the highlighted fields.", {
        timezone: "Use a zone like Asia/Kolkata or Europe/London",
      });
    }
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        name: input.name,
        headline: input.headline || null,
        phone: input.phone || null,
        timezone: input.timezone || null,
      },
    });
  },
);

export const setAvatar = userAction(z.object({ url: z.string().max(500).nullable() }), async ({ url }, ctx) => {
  assertOwnAccount(ctx);
  // Only images uploaded through our own public storage are accepted as profile photos.
  if (url !== null && !/^\/files\/public\/[\w/.-]+$/.test(url)) throw new ActionError("That image can't be used.");
  await db.user.update({ where: { id: ctx.user.id }, data: { avatarUrl: url } });
});

export const changePassword = userAction(
  z.object({ currentPassword: z.string().optional(), newPassword: z.string() }),
  async (input, ctx) => {
    assertOwnAccount(ctx);
    const limit = await rateLimit(`password-change:${ctx.user.id}`, 8, 15 * 60);
    if (!limit.ok) throw new ActionError(retryMessage(limit.retryAfter));

    const record = await db.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { passwordHash: true } });
    if (record.passwordHash && !(await verifyPassword(input.currentPassword ?? "", record.passwordHash))) {
      throw new ActionError("Please check the highlighted fields.", { currentPassword: "That isn't your current password" });
    }
    const problem = passwordProblem(input.newPassword);
    if (problem) throw new ActionError("Please check the highlighted fields.", { newPassword: problem });

    await db.user.update({ where: { id: ctx.user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
    // A new password signs out every other device.
    await revokeUserSessions(ctx.user.id, ctx.sessionId);
  },
);

export const updateEmailPreferences = userAction(
  z.object({ emailAnnouncements: z.boolean(), emailReplies: z.boolean(), emailReminders: z.boolean() }),
  async (input, ctx) => {
    assertOwnAccount(ctx);
    await db.user.update({ where: { id: ctx.user.id }, data: input });
  },
);

export const signOutOtherSessions = userAction(z.object({}), async (_input, ctx) => {
  assertOwnAccount(ctx);
  await revokeUserSessions(ctx.user.id, ctx.sessionId);
});

export const markNotificationRead = userAction(z.object({ id: z.string().min(1) }), async ({ id }, ctx) => {
  await db.notification.updateMany({ where: { id, userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } });
});

export const markAllNotificationsRead = userAction(z.object({}), async (_input, ctx) => {
  await db.notification.updateMany({ where: { userId: ctx.user.id, readAt: null }, data: { readAt: new Date() } });
});
