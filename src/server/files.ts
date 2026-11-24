import "server-only";
import { isStaff } from "@/lib/permissions";
import { isEnrollmentActive } from "@/server/access";
import type { SessionUser } from "@/server/auth/session";
import { signValue, verifySignedValue } from "@/server/crypto";
import { db } from "@/server/db";
import { fileUrl } from "@/server/storage";
import type { UploadPurpose } from "@/server/storage/uploads";

async function hasProductAccess(userId: string, productId: string) {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { status: true, expiresAt: true },
  });
  return isEnrollmentActive(enrollment);
}

/**
 * Decides whether a private file may be served. A file is private "by reference": it is
 * readable when something the viewer has access to points at it — a lesson video or a
 * deliverable of a product they own, a free-preview lesson, or their own submission.
 */
export async function canReadPrivateFile(user: SessionUser | null, key: string) {
  if (user && isStaff(user.role)) return true;
  const url = fileUrl(key);

  const [assets, lessons, recordings, submissions] = await Promise.all([
    db.asset.findMany({
      where: { fileKey: key },
      select: { productId: true, lesson: { select: { isPreview: true, isPublished: true } } },
    }),
    db.lesson.findMany({
      where: { videoUrl: url, isPublished: true },
      select: { productId: true, isPreview: true, product: { select: { status: true } } },
    }),
    db.liveSession.findMany({ where: { recordingUrl: url }, select: { productId: true } }),
    db.submission.findMany({ where: { fileKey: key }, select: { userId: true } }),
  ]);

  // Free previews are open to everyone, signed in or not.
  if (lessons.some((lesson) => lesson.isPreview && lesson.product.status === "PUBLISHED")) return true;
  if (assets.some((asset) => asset.lesson?.isPreview && asset.lesson.isPublished)) return true;
  if (!user) return false;

  if (submissions.some((submission) => submission.userId === user.id)) return true;

  const productIds = new Set([
    ...assets.map((asset) => asset.productId),
    ...lessons.map((lesson) => lesson.productId),
    ...recordings.map((recording) => recording.productId),
  ]);
  for (const productId of productIds) {
    if (await hasProductAccess(user.id, productId)) return true;
  }
  return false;
}

// ───────────────────────── Upload tickets ─────────────────────────
// A ticket proves that this server approved a specific upload (who, what, how big, where).
// It travels with the upload so no database row is needed until the file has really arrived.

export type UploadTicket = {
  key: string;
  userId: string;
  purpose: UploadPurpose;
  fileName: string;
  mimeType: string;
  size: number;
  expires: number;
};

export function sealUploadTicket(ticket: UploadTicket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

export function openUploadTicket(sealed: string | null | undefined): UploadTicket | null {
  if (!sealed) return null;
  const [payload, signature] = sealed.split(".");
  if (!payload || !signature || !verifySignedValue(payload, signature)) return null;
  try {
    const ticket = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadTicket;
    return ticket.expires > Date.now() ? ticket : null;
  } catch {
    return null;
  }
}
