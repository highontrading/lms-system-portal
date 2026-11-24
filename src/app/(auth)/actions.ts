"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Role } from "@/generated/prisma/enums";
import { isStaff } from "@/lib/permissions";
import { safeRedirectPath } from "@/lib/utils";
import { ActionError, publicAction, userAction } from "@/server/action";
import { hashPassword, passwordProblem, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, revokeUserSessions, stopImpersonation } from "@/server/auth/session";
import { consumeCode, consumeToken, issueToken, peekToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { rateLimit, rateLimitByIp, retryMessage } from "@/server/rate-limit";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";
import { emitEvent } from "@/server/webhooks";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

const nextField = z.string().max(500).optional();

function landingFor(role: Role, next: string | undefined) {
  return safeRedirectPath(next, isStaff(role) ? "/admin" : "/dashboard");
}

// Verifying against a throwaway hash keeps response times similar whether or not the account exists.
let dummyHash: Promise<string> | null = null;
function getDummyHash() {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const { token } = await issueToken({ type: "EMAIL_VERIFY", email: user.email, userId: user.id, ttlMinutes: 48 * 60 });
  await sendEmail(user.email, "verify-email", emails.verifyEmail({ name: user.name, url: absoluteUrl(`/verify-email/${token}`) }));
}

export const login = publicAction(
  z.object({ email: emailField, password: z.string().min(1, "Enter your password"), next: nextField }),
  async ({ email, password, next }) => {
    const [byAccount, byIp] = await Promise.all([
      rateLimit(`login:${email}`, 8, 15 * 60),
      rateLimitByIp("login-ip", 40, 15 * 60),
    ]);
    if (!byAccount.ok || !byIp.ok) throw new ActionError(retryMessage(Math.max(byAccount.retryAfter, byIp.retryAfter)));

    const user = await db.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !user.passwordHash || !valid) {
      throw new ActionError(
        "That email and password don't match. If you bought with this email and never set a password, use the sign-in code or “Forgot password”.",
      );
    }
    if (user.status !== "ACTIVE") throw new ActionError("This account has been suspended. Please contact support.");

    const { auth } = await getSettings();
    if (auth.requireEmailVerification && !user.emailVerifiedAt && user.role === "STUDENT") {
      await sendVerificationEmail(user);
      throw new ActionError("Please confirm your email first — we've just sent you a fresh confirmation link.");
    }

    await createSession(user.id);
    redirect(landingFor(user.role, next));
  },
  { refresh: false },
);

export const register = publicAction(
  z.object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email: emailField,
    password: z.string(),
    next: nextField,
  }),
  async ({ name, email, password, next }) => {
    const { auth } = await getSettings();
    if (!auth.allowRegistration) {
      throw new ActionError("Sign-ups are closed. Your account is created automatically when you make a purchase.");
    }
    const problem = passwordProblem(password);
    if (problem) throw new ActionError("Please check the highlighted fields.", { password: problem });

    const limit = await rateLimitByIp("register-ip", 10, 60 * 60);
    if (!limit.ok) throw new ActionError(retryMessage(limit.retryAfter));

    // An existing account can only be entered by proving ownership of the mailbox —
    // never by "registering" over it, even if it has no password yet.
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new ActionError("An account with this email already exists. Sign in instead, or use “Forgot password”.", {
        email: "This email is already registered",
      });
    }

    const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
    await emitEvent("user.created", { userId: user.id, email: user.email, name: user.name, source: "signup" });
    await sendVerificationEmail(user);

    if (auth.requireEmailVerification) return { needsVerification: true as const };

    await createSession(user.id);
    redirect(landingFor(user.role, next));
  },
  { refresh: false },
);

export const requestLoginCode = publicAction(
  z.object({ email: emailField, next: nextField }),
  async ({ email, next }) => {
    const { auth, general } = await getSettings();
    if (!auth.allowCodeLogin) throw new ActionError("Email sign-in codes are turned off. Please use your password.");

    const [byAccount, byIp] = await Promise.all([
      rateLimit(`code:${email}`, 5, 15 * 60),
      rateLimitByIp("code-ip", 25, 15 * 60),
    ]);
    if (!byAccount.ok || !byIp.ok) throw new ActionError(retryMessage(Math.max(byAccount.retryAfter, byIp.retryAfter)));

    const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } });
    if (user && user.status === "ACTIVE") {
      const { token, code } = await issueToken({
        type: "LOGIN_CODE",
        email,
        userId: user.id,
        ttlMinutes: 15,
        withCode: true,
      });
      const query = next ? `?next=${encodeURIComponent(next)}` : "";
      await sendEmail(
        email,
        "login-code",
        emails.loginCode({
          name: user.name,
          code: code!,
          url: absoluteUrl(`/auth/magic/${token}${query}`),
          siteName: general.siteName,
        }),
      );
    }
    // Same answer either way, so this can't be used to discover who has an account.
    return { sent: true as const };
  },
  { refresh: false },
);

async function signInVerified(userId: string | null, next: string | undefined): Promise<never> {
  const user = userId ? await db.user.findUnique({ where: { id: userId } }) : null;
  if (!user || user.status !== "ACTIVE") throw new ActionError("This account can't sign in. Please contact support.");
  if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await createSession(user.id);
  redirect(landingFor(user.role, next));
}

export const verifyLoginCode = publicAction(
  z.object({
    email: emailField,
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
    next: nextField,
  }),
  async ({ email, code, next }) => {
    const limit = await rateLimit(`code-verify:${email}`, 12, 15 * 60);
    if (!limit.ok) throw new ActionError(retryMessage(limit.retryAfter));
    const record = await consumeCode("LOGIN_CODE", email, code);
    if (!record) throw new ActionError("That code isn't right or has expired. Request a new one and try again.");
    return signInVerified(record.userId, next);
  },
  { refresh: false },
);

export const confirmMagicLink = publicAction(
  z.object({ token: z.string().min(10), next: nextField }),
  async ({ token, next }) => {
    const record = await consumeToken("LOGIN_CODE", token);
    if (!record) throw new ActionError("This sign-in link has expired or was already used. Request a new one.");
    return signInVerified(record.userId, next);
  },
  { refresh: false },
);

export const requestPasswordReset = publicAction(
  z.object({ email: emailField }),
  async ({ email }) => {
    const [byAccount, byIp] = await Promise.all([
      rateLimit(`reset:${email}`, 4, 30 * 60),
      rateLimitByIp("reset-ip", 20, 30 * 60),
    ]);
    if (!byAccount.ok || !byIp.ok) throw new ActionError(retryMessage(Math.max(byAccount.retryAfter, byIp.retryAfter)));

    const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true, status: true } });
    if (user && user.status === "ACTIVE") {
      const { token } = await issueToken({ type: "PASSWORD_RESET", email, userId: user.id, ttlMinutes: 60 });
      await sendEmail(
        email,
        "password-reset",
        emails.passwordReset({ name: user.name, url: absoluteUrl(`/reset-password/${token}`) }),
      );
    }
    return { sent: true as const };
  },
  { refresh: false },
);

export const resetPassword = publicAction(
  z.object({ token: z.string().min(10), password: z.string() }),
  async ({ token, password }) => {
    const problem = passwordProblem(password);
    if (problem) throw new ActionError("Please check the highlighted fields.", { password: problem });

    const record = await consumeToken("PASSWORD_RESET", token);
    if (!record?.userId) throw new ActionError("This reset link has expired or was already used. Request a new one.");

    const user = await db.user.update({
      where: { id: record.userId },
      // Completing a reset proves control of the mailbox.
      data: { passwordHash: await hashPassword(password), emailVerifiedAt: new Date() },
    });
    if (user.status !== "ACTIVE") throw new ActionError("This account has been suspended. Please contact support.");

    await revokeUserSessions(user.id);
    await createSession(user.id);
    redirect(landingFor(user.role, undefined));
  },
  { refresh: false },
);

/** Finishes setting up an account that was created for someone (by a purchase, an import or an admin). */
export const acceptInvite = publicAction(
  z.object({
    token: z.string().min(10),
    name: z.string().trim().min(2, "Enter your name").max(80),
    password: z.string().optional(),
    next: nextField,
  }),
  async ({ token, name, password, next }) => {
    if (password) {
      const problem = passwordProblem(password);
      if (problem) throw new ActionError("Please check the highlighted fields.", { password: problem });
    }
    if (!(await peekToken("INVITE", token))) {
      throw new ActionError("This link has expired or was already used. Use “Forgot password” to get a new one.");
    }
    const record = await consumeToken("INVITE", token);
    if (!record?.userId) throw new ActionError("This link has expired or was already used.");

    const user = await db.user.update({
      where: { id: record.userId },
      data: {
        name,
        emailVerifiedAt: new Date(),
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    if (user.status !== "ACTIVE") throw new ActionError("This account has been suspended. Please contact support.");

    await createSession(user.id);
    redirect(landingFor(user.role, next));
  },
  { refresh: false },
);

export const resendVerification = userAction(
  z.object({}),
  async (_input, { user }) => {
    if (user.emailVerified) return { alreadyVerified: true };
    const limit = await rateLimit(`verify:${user.id}`, 3, 30 * 60);
    if (!limit.ok) throw new ActionError(retryMessage(limit.retryAfter));
    await sendVerificationEmail(user);
    return { alreadyVerified: false };
  },
  { refresh: false },
);

export async function logout() {
  await destroySession();
  redirect("/");
}

/** Returns a staff member from "view as student" back to their own session. */
export async function stopViewingAsStudent() {
  await stopImpersonation();
  redirect("/admin/students");
}
