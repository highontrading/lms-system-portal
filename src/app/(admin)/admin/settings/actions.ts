"use server";

import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import type { SettingsSection } from "@/lib/settings-schema";
import { ActionError, staffAction } from "@/server/action";
import { audit } from "@/server/audit";
import { sendEmail } from "@/server/email/send";
import { emails } from "@/server/email/templates";
import { getEmailConfig, loadSettings, saveSettings } from "@/server/settings";

// Sections the admin panel edits. Payments and invoices are not part of this product.
const SECTIONS = ["general", "branding", "home", "navigation", "auth", "learning", "certificate", "email", "seo", "support"] as const;

function isValidLocale(locale: string) {
  try {
    new Intl.DateTimeFormat(locale);
    return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0;
  } catch {
    return false;
  }
}

export const saveSettingsSection = staffAction(
  "settings.manage",
  z.object({ section: z.enum(SECTIONS), values: z.record(z.string(), z.unknown()) }),
  async ({ section, values }, ctx) => {
    if (section === "general") {
      const fieldErrors: Record<string, string> = {};
      const timezone = typeof values.timezone === "string" ? values.timezone.trim() : "";
      const locale = typeof values.locale === "string" ? values.locale.trim() : "";
      if (timezone && !isValidTimeZone(timezone)) fieldErrors.timezone = "Use a time zone name such as Asia/Kolkata or Europe/London.";
      if (locale && !isValidLocale(locale)) fieldErrors.locale = "Use a locale such as en-IN or en-US.";
      if (Object.keys(fieldErrors).length > 0) throw new ActionError("Please check the highlighted fields.", fieldErrors);
    }

    const result = await saveSettings(section as SettingsSection, values);
    if (!result.ok) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      throw new ActionError("Please check the highlighted fields.", fieldErrors);
    }

    await audit(ctx.user, "settings.update", `Updated ${section} settings`, { entityType: "setting", entityId: section });
    return { saved: true as const };
  },
);

/** Sends a test message to the signed-in admin using the saved email settings. */
export const sendTestEmail = staffAction(
  "settings.manage",
  z.object({}),
  async (_input, ctx) => {
    const [{ general }, config] = await Promise.all([loadSettings(), getEmailConfig()]);
    const result = await sendEmail(ctx.user.email, "test", emails.test({ siteName: general.siteName }));
    if (!result.ok) throw new ActionError(`The test email could not be sent: ${result.error}`);
    return { provider: config.provider, to: ctx.user.email };
  },
  { refresh: false },
);
