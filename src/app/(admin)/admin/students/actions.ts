"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, isUniqueViolation, staffAction } from "@/server/action";
import { grantAccess, revokeAccess, sendAccessEmail } from "@/server/access";
import { findOrCreateStudent, normalizeEmail } from "@/server/accounts";
import { parseExpiryChoice } from "@/server/admin/people";
import { audit } from "@/server/audit";
import { revokeUserSessions, startImpersonation } from "@/server/auth/session";
import { issueToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { markProductComplete, resetProgress } from "@/server/progress";
import { absoluteUrl } from "@/server/url";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

const expiryField = z
  .string()
  .regex(/^(lifetime|\d{4}-\d{2}-\d{2})?$/, "Pick a date")
  .optional();

async function loadStudent(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new ActionError("That student no longer exists.");
  return user;
}

async function loadEnrollment(id: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      product: { select: { id: true, title: true } },
    },
  });
  if (!enrollment) throw new ActionError("That access record no longer exists.");
  return enrollment;
}

export const addStudent = staffAction(
  "students.manage",
  z.object({
    name: z.string().trim().max(80).optional(),
    email: emailField,
    productIds: z.array(z.string()).max(50).default([]),
    sendEmail: z.boolean().default(true),
  }),
  async ({ name, email, productIds, sendEmail: notifyByEmail }, ctx) => {
    const { user, created } = await findOrCreateStudent({ email, name });
    if (!created && productIds.length === 0) {
      throw new ActionError("A student with this email already exists.", { email: "Already a student" });
    }

    let granted = 0;
    for (const productId of productIds) {
      const { enrollment, outcome } = await grantAccess({ userId: user.id, productId, source: "MANUAL" });
      if (outcome === "created" || outcome === "reactivated") {
        granted += 1;
        if (notifyByEmail) await sendAccessEmail(enrollment.id);
      }
    }

    await audit(
      ctx.user,
      created ? "student.create" : "access.grant",
      `${created ? "Added student" : "Granted access to"} ${user.email}${granted ? ` (${granted} product${granted === 1 ? "" : "s"})` : ""}`,
      { entityType: "user", entityId: user.id },
    );
    return { id: user.id, created, granted };
  },
);

export const updateStudent = staffAction(
  "students.manage",
  z.object({
    id: z.string(),
    name: z.string().trim().min(2, "Enter a name").max(80),
    email: emailField,
    phone: z.string().trim().max(30).optional(),
    adminNote: z.string().trim().max(2000).optional(),
  }),
  async ({ id, name, email, phone, adminNote }, ctx) => {
    const user = await loadStudent(id);
    try {
      await db.user.update({
        where: { id },
        data: {
          name,
          email: normalizeEmail(email),
          phone: phone || null,
          adminNote: adminNote || null,
          // A changed address has not been confirmed by its owner yet.
          ...(email !== user.email ? { emailVerifiedAt: null } : {}),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError("Another account already uses that email address.", { email: "Already in use" });
      }
      throw error;
    }
    await audit(ctx.user, "student.update", `Updated ${email}`, { entityType: "user", entityId: id });
  },
);

export const setStudentStatus = staffAction(
  "students.manage",
  z.object({ id: z.string(), status: z.enum(["ACTIVE", "SUSPENDED"]) }),
  async ({ id, status }, ctx) => {
    const user = await loadStudent(id);
    if (user.role !== "STUDENT") throw new ActionError("Team members are managed from the Team page.");
    await db.user.update({ where: { id }, data: { status } });
    if (status === "SUSPENDED") await revokeUserSessions(id);
    await audit(
      ctx.user,
      status === "SUSPENDED" ? "student.suspend" : "student.reactivate",
      `${status === "SUSPENDED" ? "Suspended" : "Reactivated"} ${user.email}`,
      { entityType: "user", entityId: id },
    );
  },
);

export const sendStudentPasswordReset = staffAction(
  "students.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const user = await loadStudent(id);
    if (user.status !== "ACTIVE") throw new ActionError("Reactivate this account before sending a reset link.");
    const { token } = await issueToken({ type: "PASSWORD_RESET", email: user.email, userId: user.id, ttlMinutes: 60 });
    const result = await sendEmail(
      user.email,
      "password-reset",
      emails.passwordReset({ name: user.name, url: absoluteUrl(`/reset-password/${token}`) }),
    );
    if (!result.ok) throw new ActionError(`The email could not be sent: ${result.error}`);
    await audit(ctx.user, "student.password-reset", `Sent a password reset link to ${user.email}`, {
      entityType: "user",
      entityId: id,
    });
  },
  { refresh: false },
);

/** Signs the admin in as the student so they can see exactly what the student sees. */
export const viewAsStudent = staffAction(
  "students.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const user = await loadStudent(id);
    if (user.role !== "STUDENT") throw new ActionError("You can only view the portal as a student.");
    if (user.status !== "ACTIVE") throw new ActionError("Reactivate this account first.");
    await startImpersonation(ctx.user.id, user.id);
    await audit(ctx.user, "student.impersonate", `Viewed the portal as ${user.email}`, {
      entityType: "user",
      entityId: id,
    });
    redirect("/dashboard");
  },
  { refresh: false },
);

// ───────────────────────────── Access ─────────────────────────────

export const grantStudentAccess = staffAction(
  "enrollments.manage",
  z.object({
    userId: z.string(),
    productId: z.string().min(1, "Choose a product"),
    expiry: expiryField,
    sendEmail: z.boolean().default(true),
  }),
  async ({ userId, productId, expiry, sendEmail: notifyByEmail }, ctx) => {
    const user = await loadStudent(userId);
    const product = await db.product.findUnique({ where: { id: productId }, select: { title: true } });
    if (!product) throw new ActionError("That product no longer exists.", { productId: "Choose a product" });

    const { enrollment, outcome } = await grantAccess({
      userId,
      productId,
      source: "MANUAL",
      expiresAt: await parseExpiryChoice(expiry),
    });
    if (notifyByEmail && (outcome === "created" || outcome === "reactivated")) await sendAccessEmail(enrollment.id);

    await audit(ctx.user, "access.grant", `Granted ${product.title} to ${user.email}`, {
      entityType: "enrollment",
      entityId: enrollment.id,
    });
    return { outcome };
  },
);

export const revokeEnrollment = staffAction(
  "enrollments.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const enrollment = await loadEnrollment(id);
    await revokeAccess(id, `Revoked by ${ctx.user.email}`);
    await audit(ctx.user, "access.revoke", `Revoked ${enrollment.product.title} from ${enrollment.user.email}`, {
      entityType: "enrollment",
      entityId: id,
    });
  },
);

export const restoreEnrollment = staffAction(
  "enrollments.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const enrollment = await loadEnrollment(id);
    // Keep an end date that is still in the future; otherwise fall back to the product's default period.
    const keep = enrollment.expiresAt && enrollment.expiresAt > new Date() ? enrollment.expiresAt : undefined;
    await grantAccess({
      userId: enrollment.userId,
      productId: enrollment.productId,
      source: "MANUAL",
      expiresAt: keep,
      notify: false,
    });
    await audit(ctx.user, "access.restore", `Restored ${enrollment.product.title} for ${enrollment.user.email}`, {
      entityType: "enrollment",
      entityId: id,
    });
  },
);

export const changeEnrollmentExpiry = staffAction(
  "enrollments.manage",
  z.object({ id: z.string(), expiry: z.string().regex(/^(lifetime|\d{4}-\d{2}-\d{2})$/, "Pick a date or lifetime") }),
  async ({ id, expiry }, ctx) => {
    const enrollment = await loadEnrollment(id);
    if (enrollment.status === "REVOKED") throw new ActionError("Restore this access before changing its end date.");
    const expiresAt = await parseExpiryChoice(expiry);
    if (expiresAt === undefined) throw new ActionError("Pick a valid date.", { expiry: "Pick a valid date" });
    await grantAccess({
      userId: enrollment.userId,
      productId: enrollment.productId,
      source: "MANUAL",
      expiresAt,
      notify: false,
    });
    await audit(
      ctx.user,
      "access.expiry",
      `Set ${enrollment.product.title} for ${enrollment.user.email} to ${expiry === "lifetime" ? "lifetime access" : `end on ${expiry}`}`,
      { entityType: "enrollment", entityId: id },
    );
  },
);

export const resetEnrollmentProgress = staffAction(
  "enrollments.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const enrollment = await loadEnrollment(id);
    await resetProgress(enrollment.userId, enrollment.productId);
    await audit(ctx.user, "progress.reset", `Reset progress on ${enrollment.product.title} for ${enrollment.user.email}`, {
      entityType: "enrollment",
      entityId: id,
    });
  },
);

export const completeEnrollment = staffAction(
  "enrollments.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const enrollment = await loadEnrollment(id);
    const result = await markProductComplete(enrollment.userId, enrollment.productId);
    if (result && result.total === 0) throw new ActionError("This product has no lessons to complete.");
    await audit(ctx.user, "progress.complete", `Marked ${enrollment.product.title} complete for ${enrollment.user.email}`, {
      entityType: "enrollment",
      entityId: id,
    });
  },
);

export const resendAccessEmail = staffAction(
  "enrollments.manage",
  z.object({ id: z.string() }),
  async ({ id }, ctx) => {
    const enrollment = await loadEnrollment(id);
    if (enrollment.status === "REVOKED") throw new ActionError("This access has been revoked.");
    await sendAccessEmail(id);
    await audit(ctx.user, "access.email", `Re-sent the access email for ${enrollment.product.title} to ${enrollment.user.email}`, {
      entityType: "enrollment",
      entityId: id,
    });
  },
  { refresh: false },
);
