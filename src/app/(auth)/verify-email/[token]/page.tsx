import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { LinkExpired } from "@/components/auth/link-expired";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/auth/session";
import { consumeToken } from "@/server/auth/tokens";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [record, session] = await Promise.all([consumeToken("EMAIL_VERIFY", token), getSession()]);

  if (!record?.userId) {
    return (
      <LinkExpired
        title="This confirmation link has expired"
        description="Sign in and we'll offer to send you a fresh confirmation link from your account page."
        actionLabel={session ? "Go to my account" : "Sign in"}
        actionHref={session ? "/account" : "/login"}
      />
    );
  }

  await db.user.updateMany({ where: { id: record.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });

  return (
    <div className="grid gap-4">
      <span className="grid size-11 place-items-center rounded-full bg-success-soft text-success-text">
        <BadgeCheck className="size-5" />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Email confirmed</h1>
      <p className="text-sm text-muted-foreground">Thanks — your email address is verified.</p>
      <Button asChild size="lg">
        <Link href={session ? "/dashboard" : "/login"}>{session ? "Go to my dashboard" : "Sign in"}</Link>
      </Button>
    </div>
  );
}
