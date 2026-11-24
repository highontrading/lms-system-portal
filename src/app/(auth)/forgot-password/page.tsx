import type { Metadata } from "next";
import { connection } from "next/server";
import { ForgotPasswordForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  // The page title comes from live settings, so this page renders per request like the rest.
  await connection();
  return <ForgotPasswordForm />;
}
