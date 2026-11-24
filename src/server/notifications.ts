import "server-only";
import { db } from "@/server/db";

export type NotificationInput = {
  type:
    | "access"
    | "announcement"
    | "certificate"
    | "reply"
    | "grade"
    | "update"
    | "live"
    | "order"
    | "ticket"
    | "review"
    | "system";
  title: string;
  body?: string | null;
  href?: string | null;
};

/** Adds an item to one or many users' notification inboxes. */
export async function notify(userIds: string | string[], input: NotificationInput) {
  const ids = [...new Set(Array.isArray(userIds) ? userIds : [userIds])];
  if (ids.length === 0) return;
  await db.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body?.slice(0, 500) ?? null,
      href: input.href ?? null,
    })),
  });
}

/** Staff who should hear about something that needs attention (new ticket, new submission…). */
export async function staffIdsWith(roles: ("OWNER" | "ADMIN" | "INSTRUCTOR" | "SUPPORT")[]) {
  const staff = await db.user.findMany({
    where: { role: { in: roles }, status: "ACTIVE" },
    select: { id: true },
  });
  return staff.map((member) => member.id);
}
