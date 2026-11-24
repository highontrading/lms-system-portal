import type { Metadata } from "next";
import { WelcomeForm } from "@/components/auth/forms";
import { LinkExpired } from "@/components/auth/link-expired";
import { isStaff } from "@/lib/permissions";
import { firstParam, type SearchParams } from "@/lib/utils";
import { peekToken } from "@/server/auth/tokens";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function WelcomePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const record = await peekToken("INVITE", token);
  const user = record?.userId
    ? await db.user.findUnique({ where: { id: record.userId }, select: { name: true, email: true, role: true } })
    : null;

  if (!record || !user) {
    return (
      <LinkExpired
        title="This link is no longer valid"
        description="It has already been used or has expired. You can still get in: enter your email on the sign-in page and we'll send you a code, or reset your password."
        actionLabel="Go to sign in"
        actionHref="/login"
      />
    );
  }

  return (
    <WelcomeForm
      token={token}
      next={firstParam(query.next)}
      email={user.email}
      initialName={user.name}
      role={isStaff(user.role) ? "staff" : "student"}
    />
  );
}
