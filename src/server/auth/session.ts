import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { after } from "next/server";
import type { Role } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { randomToken, sha256 } from "@/server/crypto";
import { isSecureSite, requestMeta } from "@/server/url";

export const SESSION_COOKIE = "ia_session";
/** Holds the admin's own session while they are viewing the portal as a student. */
export const ADMIN_RETURN_COOKIE = "ia_admin_return";

const DAY = 24 * 60 * 60 * 1000;
const SESSION_LIFETIME = 30 * DAY;
const COOKIE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60;
const TOUCH_INTERVAL = 6 * 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  timezone: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
};

export type AuthContext = {
  sessionId: string;
  user: SessionUser;
  /** Set while a staff member is signed in as this user. */
  impersonatorId: string | null;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureSite(),
    path: "/",
    maxAge,
  };
}

async function insertSession(userId: string, impersonatorId: string | null) {
  const token = randomToken(32);
  const { ip, userAgent } = await requestMeta();
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      impersonatorId,
      ip,
      userAgent,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME),
    },
  });
  return token;
}

/** Signs a user in on this browser. Only callable from Server Actions and Route Handlers. */
export async function createSession(userId: string) {
  const token = await insertSession(userId, null);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(COOKIE_MAX_AGE_SECONDS));
  jar.delete(ADMIN_RETURN_COOKIE);
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), lastActiveAt: new Date() } });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
  jar.delete(ADMIN_RETURN_COOKIE);
}

/** Swap the current browser to a session for `userId`, remembering how to get back. */
export async function startImpersonation(staffId: string, userId: string) {
  const jar = await cookies();
  const current = jar.get(SESSION_COOKIE)?.value;
  if (!current) throw new Error("No active session");
  const token = await insertSession(userId, staffId);
  jar.set(ADMIN_RETURN_COOKIE, current, cookieOptions(60 * 60 * 8));
  jar.set(SESSION_COOKIE, token, cookieOptions(60 * 60 * 8));
}

export async function stopImpersonation() {
  const jar = await cookies();
  const impersonating = jar.get(SESSION_COOKIE)?.value;
  const original = jar.get(ADMIN_RETURN_COOKIE)?.value;
  if (impersonating) await db.session.deleteMany({ where: { tokenHash: sha256(impersonating) } });
  jar.delete(ADMIN_RETURN_COOKIE);
  if (original) jar.set(SESSION_COOKIE, original, cookieOptions(COOKIE_MAX_AGE_SECONDS));
  else jar.delete(SESSION_COOKIE);
}

/**
 * The signed-in user for this request, or null. Deduplicated per request, so layouts, pages
 * and data helpers can all call it freely.
 */
export const getSession = cache(async (): Promise<AuthContext | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          avatarUrl: true,
          timezone: true,
          emailVerifiedAt: true,
          passwordHash: true,
        },
      },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.user.status !== "ACTIVE") return null;

  if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL) {
    // Sliding expiry: keep active learners signed in without writing on every request.
    after(async () => {
      try {
        await db.session.update({
          where: { id: session.id },
          data: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_LIFETIME) },
        });
        if (!session.impersonatorId) {
          await db.user.update({ where: { id: session.userId }, data: { lastActiveAt: new Date(now) } });
        }
      } catch {
        // The session may have been revoked in the meantime.
      }
    });
  }

  const { user } = session;
  return {
    sessionId: session.id,
    impersonatorId: session.impersonatorId,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      timezone: user.timezone,
      emailVerified: !!user.emailVerifiedAt,
      hasPassword: !!user.passwordHash,
    },
  };
});

/** Signs the user out everywhere, optionally keeping the session that made the request. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
