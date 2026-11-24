import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { isStaff } from "@/lib/permissions";
import { firstParam, safeRedirectPath, type SearchParams } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, session, { auth }] = await Promise.all([searchParams, getSession(), getSettings()]);
  const next = firstParam(params.next);
  if (session) redirect(safeRedirectPath(next, isStaff(session.user.role) ? "/admin" : "/dashboard"));

  return (
    <LoginForm
      next={next}
      allowCodeLogin={auth.allowCodeLogin}
      allowRegistration={auth.allowRegistration}
      initialEmail={firstParam(params.email) ?? ""}
    />
  );
}
