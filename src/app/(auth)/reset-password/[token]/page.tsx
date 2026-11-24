import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/forms";
import { LinkExpired } from "@/components/auth/link-expired";
import { peekToken } from "@/server/auth/tokens";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await peekToken("PASSWORD_RESET", token))) {
    return (
      <LinkExpired
        description="Reset links work once and expire after an hour. Request a new one and we'll email it straight away."
        actionLabel="Request a new link"
        actionHref="/forgot-password"
      />
    );
  }
  return <ResetPasswordForm token={token} />;
}
