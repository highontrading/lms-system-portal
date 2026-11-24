import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { emitEvent } from "@/server/webhooks";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** "rahul.sharma92@gmail.com" → "Rahul Sharma" — a friendly placeholder until the student sets their name. */
export function nameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/\+.*$/, "")
    .replace(/[0-9]+/g, " ")
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  return words.join(" ").slice(0, 80) || "Learner";
}

/**
 * Finds the account for an email address or creates a password-less student account for it.
 * Used when access is granted to someone who has not signed up yet.
 */
export async function findOrCreateStudent(input: { email: string; name?: string | null; phone?: string | null }) {
  const email = normalizeEmail(input.email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { user: existing, created: false };

  try {
    const user = await db.user.create({
      data: {
        email,
        name: input.name?.trim().slice(0, 80) || nameFromEmail(email),
        phone: input.phone?.trim().slice(0, 30) || null,
      },
    });
    await emitEvent("user.created", { userId: user.id, email: user.email, name: user.name, source: "provisioned" });
    return { user, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { user: await db.user.findUniqueOrThrow({ where: { email } }), created: false };
    }
    throw error;
  }
}
