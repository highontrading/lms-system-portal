import type { Metadata } from "next";
import { MagicLinkForm } from "@/components/auth/forms";
import { LinkExpired } from "@/components/auth/link-expired";
import { firstParam, type SearchParams } from "@/lib/utils";
import { peekToken } from "@/server/auth/tokens";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// The link is confirmed with a button press rather than on page load, so email security
// scanners that open links can't use up a one-time sign-in link before its owner does.
export default async function MagicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: SearchParams;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!(await peekToken("LOGIN_CODE", token))) {
    return (
      <LinkExpired
        description="Sign-in links work once and expire after 15 minutes. Ask for a new code and try again."
        actionLabel="Back to sign in"
        actionHref="/login"
      />
    );
  }
  return <MagicLinkForm token={token} next={firstParam(query.next)} />;
}
