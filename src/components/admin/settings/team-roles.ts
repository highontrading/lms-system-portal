import type { Role } from "@/generated/prisma/enums";

/** What each staff role can do in this release, in plain words. */
export const TEAM_ROLE_DESCRIPTIONS: Record<Exclude<Role, "STUDENT">, string> = {
  OWNER: "Full access to everything, including the team and settings. There is always at least one owner.",
  ADMIN: "Full access to every part of the admin panel.",
  INSTRUCTOR: "Creates and edits products and lessons, sees students and posts announcements.",
  SUPPORT: "Helps students: views and edits student accounts and grants or removes access.",
};
