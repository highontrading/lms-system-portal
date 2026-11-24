import type { Role } from "@/generated/prisma/enums";

export const PERMISSIONS = [
  "admin.access",
  "products.manage",
  "students.view",
  "students.manage",
  "enrollments.manage",
  "orders.view",
  "orders.manage",
  "coupons.manage",
  "engagement.moderate",
  "submissions.grade",
  "announcements.manage",
  "support.manage",
  "media.manage",
  "pages.manage",
  "settings.manage",
  "integrations.manage",
  "team.manage",
  "logs.view",
  "reports.export",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  INSTRUCTOR: [
    "admin.access",
    "products.manage",
    "students.view",
    "engagement.moderate",
    "submissions.grade",
    "announcements.manage",
    "support.manage",
    "media.manage",
  ],
  SUPPORT: [
    "admin.access",
    "students.view",
    "students.manage",
    "enrollments.manage",
    "orders.view",
    "engagement.moderate",
    "support.manage",
  ],
  STUDENT: [],
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function isStaff(role: Role) {
  return role !== "STUDENT";
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  INSTRUCTOR: "Instructor",
  SUPPORT: "Support",
  STUDENT: "Student",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including team and billing settings. There is always at least one owner.",
  ADMIN: "Full access to every part of the admin panel.",
  INSTRUCTOR: "Manages products and content, grades submissions, moderates discussions and posts announcements.",
  SUPPORT: "Helps students: views and edits students, manages access, views orders and answers tickets.",
  STUDENT: "Learns in the portal. No admin access.",
};

/** Roles a given actor is allowed to assign to someone else. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === "OWNER") return ["OWNER", "ADMIN", "INSTRUCTOR", "SUPPORT", "STUDENT"];
  if (actor === "ADMIN") return ["ADMIN", "INSTRUCTOR", "SUPPORT", "STUDENT"];
  return [];
}
