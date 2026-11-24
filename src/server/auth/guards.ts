import "server-only";
import { redirect } from "next/navigation";
import { can, isStaff, type Permission } from "@/lib/permissions";
import { getSession, type AuthContext } from "@/server/auth/session";
import { currentPath } from "@/server/url";

/** Page-level guard: the signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<AuthContext> {
  const ctx = await getSession();
  if (ctx) return ctx;
  const path = await currentPath();
  redirect(path && path !== "/" ? `/login?next=${encodeURIComponent(path)}` : "/login");
}

/** Page-level guard for the admin panel. Students go to their dashboard; staff without the permission see a notice. */
export async function requireStaff(permission: Permission = "admin.access"): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!isStaff(ctx.user.role)) redirect("/dashboard");
  if (!can(ctx.user.role, permission)) redirect("/admin/no-access");
  return ctx;
}

export async function getOptionalUser() {
  return (await getSession())?.user ?? null;
}
