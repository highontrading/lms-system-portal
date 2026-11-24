import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/forms";
import { Button } from "@/components/ui/button";
import { firstParam, safeRedirectPath, type SearchParams } from "@/lib/utils";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, session, { auth }] = await Promise.all([searchParams, getSession(), getSettings()]);
  const next = firstParam(params.next);
  if (session) redirect(safeRedirectPath(next, "/dashboard"));

  if (!auth.allowRegistration) {
    return (
      <div className="grid gap-4">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight">Sign-ups are closed</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t need to register. Your account is created automatically when you buy something — just sign in
          with the email address you paid with.
        </p>
        <Button asChild size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const legalPages = await db.page.count({ where: { slug: { in: ["terms", "privacy"] }, isPublished: true } });
  return <RegisterForm next={next} hasTerms={legalPages === 2} />;
}
