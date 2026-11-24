import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSection } from "@/components/admin/settings/sections";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { requireStaff } from "@/server/auth/guards";
import { getEmailConfig, getSettings, redactSecrets } from "@/server/settings";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  return { title: `${findSection(section)?.label ?? "Settings"} settings` };
}

export default async function SettingsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const ctx = await requireStaff("settings.manage");
  const { section } = await params;
  const spec = findSection(section);
  if (!spec) notFound();

  const settings = await getSettings();
  // Credentials never leave the server: the form only learns whether each one is set.
  const { value, configured } = redactSecrets(spec.id, settings[spec.id]);

  // When the hosting environment provides email credentials they take precedence over these fields.
  let notice: string | null = null;
  if (spec.id === "email") {
    const effective = await getEmailConfig();
    if (effective.provider !== settings.email.provider) {
      notice = `Email is currently controlled by the server environment (provider: ${effective.provider}). The values below are used only if those environment variables are removed.`;
    }
  }

  return (
    <SettingsForm
      key={spec.id}
      spec={spec}
      initialValues={value as Record<string, unknown>}
      configuredSecrets={configured}
      adminEmail={ctx.user.email}
      notice={notice}
    />
  );
}
