import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  SECRET_FIELDS,
  SETTINGS_SECTIONS,
  settingsSchemas,
  type Settings,
  type SettingsSection,
} from "@/lib/settings-schema";
import { db } from "@/server/db";
import { decryptSecret, encryptSecret, isEncrypted } from "@/server/crypto";

// A short in-process memo keeps settings from costing a query on every render.
// Saving from the admin panel clears it; other server instances catch up within the TTL.
const MEMO_TTL_MS = 5_000;
let memo: { at: number; value: Settings } | null = null;

function parseSection<K extends SettingsSection>(section: K, raw: unknown): Settings[K] {
  const schema = settingsSchemas[section];
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return parsed.data as Settings[K];
  // A stored value that no longer fits the schema must never take the site down.
  console.warn(`[settings] Stored "${section}" settings are invalid; using defaults.`, parsed.error.issues[0]);
  return schema.parse({}) as Settings[K];
}

/** Reads settings without touching request APIs — safe in background work (emails, webhooks, cron). */
export async function loadSettings(): Promise<Settings> {
  if (memo && Date.now() - memo.at < MEMO_TTL_MS) return memo.value;
  const rows = await db.setting.findMany();
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  const value = {} as Record<SettingsSection, unknown>;
  for (const section of SETTINGS_SECTIONS) value[section] = parseSection(section, stored.get(section));
  memo = { at: Date.now(), value: value as Settings };
  return memo.value;
}

/** Settings for the current request. Deduplicated across layouts, pages and metadata. */
export const getSettings = cache(async (): Promise<Settings> => {
  // Settings are live data: never bake them into a build-time prerender.
  await connection();
  return loadSettings();
});

/**
 * Validates and stores one settings section. Credential fields left blank keep their
 * current value, so the admin form never has to send a secret back to the browser.
 */
export async function saveSettings<K extends SettingsSection>(section: K, input: unknown) {
  const current = (await loadSettings())[section] as Record<string, unknown>;
  const candidate = { ...(input as Record<string, unknown>) };
  const secretFields = (SECRET_FIELDS[section] ?? []) as string[];

  for (const field of secretFields) {
    const incoming = candidate[field];
    if (typeof incoming !== "string" || incoming.trim() === "") candidate[field] = current[field] ?? "";
    else candidate[field] = encryptSecret(incoming.trim());
  }

  const parsed = settingsSchemas[section].safeParse(candidate);
  if (!parsed.success) return { ok: false as const, error: parsed.error };

  await db.setting.upsert({
    where: { key: section },
    create: { key: section, value: parsed.data as Prisma.InputJsonValue },
    update: { value: parsed.data as Prisma.InputJsonValue },
  });
  memo = null;
  return { ok: true as const, value: parsed.data as Settings[K] };
}

export function clearSettingsCache() {
  memo = null;
}

/** Replaces stored credentials with a boolean "is it set?" before settings reach a client component. */
export function redactSecrets<K extends SettingsSection>(section: K, value: Settings[K]) {
  const out = { ...(value as Record<string, unknown>) };
  const configured: Record<string, boolean> = {};
  for (const field of (SECRET_FIELDS[section] ?? []) as string[]) {
    configured[field] = typeof out[field] === "string" && (out[field] as string).length > 0;
    out[field] = "";
  }
  return { value: out as Settings[K], configured };
}

// ───────────────────── Resolved credentials (environment wins) ─────────────────────

function fromEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function secret(stored: string, envName: string) {
  return fromEnv(envName) ?? (isEncrypted(stored) ? decryptSecret(stored) : stored);
}

export type EmailConfig = {
  provider: "log" | "smtp" | "resend";
  fromName: string;
  fromEmail: string;
  replyTo: string;
  smtp: { host: string; port: number; secure: boolean; user: string; password: string };
  resendApiKey: string;
};

export async function getEmailConfig(): Promise<EmailConfig> {
  const { email, general } = await loadSettings();
  const envProvider = fromEnv("EMAIL_PROVIDER");
  const provider =
    envProvider === "smtp" || envProvider === "resend" || envProvider === "log" ? envProvider : email.provider;
  return {
    provider,
    fromName: fromEnv("EMAIL_FROM_NAME") ?? (email.fromName || general.siteName),
    fromEmail: fromEnv("EMAIL_FROM") ?? email.fromEmail,
    replyTo: email.replyTo || general.supportEmail,
    smtp: {
      host: fromEnv("SMTP_HOST") ?? email.smtpHost,
      port: Number(fromEnv("SMTP_PORT") ?? email.smtpPort),
      secure: fromEnv("SMTP_SECURE") ? fromEnv("SMTP_SECURE") === "true" : email.smtpSecure,
      user: fromEnv("SMTP_USER") ?? email.smtpUser,
      password: secret(email.smtpPassword, "SMTP_PASSWORD"),
    },
    resendApiKey: secret(email.resendApiKey, "RESEND_API_KEY"),
  };
}

export type PaymentConfig = {
  razorpay: { keyId: string; keySecret: string; webhookSecret: string } | null;
  stripe: { secretKey: string; webhookSecret: string } | null;
  preferred: "razorpay" | "stripe";
};

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const { payments } = await loadSettings();

  const razorpayKeyId = fromEnv("RAZORPAY_KEY_ID") ?? payments.razorpayKeyId;
  const razorpayKeySecret = secret(payments.razorpayKeySecret, "RAZORPAY_KEY_SECRET");
  const razorpayOn = fromEnv("RAZORPAY_KEY_ID") ? true : payments.razorpayEnabled;

  const stripeSecretKey = secret(payments.stripeSecretKey, "STRIPE_SECRET_KEY");
  const stripeOn = fromEnv("STRIPE_SECRET_KEY") ? true : payments.stripeEnabled;

  return {
    razorpay:
      razorpayOn && razorpayKeyId && razorpayKeySecret
        ? {
            keyId: razorpayKeyId,
            keySecret: razorpayKeySecret,
            webhookSecret: secret(payments.razorpayWebhookSecret, "RAZORPAY_WEBHOOK_SECRET"),
          }
        : null,
    stripe:
      stripeOn && stripeSecretKey
        ? { secretKey: stripeSecretKey, webhookSecret: secret(payments.stripeWebhookSecret, "STRIPE_WEBHOOK_SECRET") }
        : null,
    preferred: payments.preferredGateway,
  };
}
