import "server-only";
import nodemailer from "nodemailer";
import { db } from "@/server/db";
import { getEmailConfig, type EmailConfig } from "@/server/settings";
import { renderEmail, type EmailContent } from "@/server/email/render";

export type SendResult = { ok: true } | { ok: false; error: string };

type Message = {
  to: string;
  subject: string;
  html: string;
  text: string;
  template?: string;
};

function fromHeader(config: EmailConfig) {
  const name = config.fromName.replace(/["<>]/g, "");
  return name ? `"${name}" <${config.fromEmail}>` : config.fromEmail;
}

async function deliver(config: EmailConfig, message: Message): Promise<SendResult> {
  if (config.provider === "log") return { ok: true };

  if (!config.fromEmail) return { ok: false, error: "No sender address is configured (Settings → Email)." };

  if (config.provider === "resend") {
    if (!config.resendApiKey) return { ok: false, error: "The Resend API key is missing." };
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromHeader(config),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: config.replyTo || undefined,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend responded ${response.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  }

  if (!config.smtp.host) return { ok: false, error: "The SMTP host is missing." };
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    connectionTimeout: 15_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    from: fromHeader(config),
    to: message.to,
    replyTo: config.replyTo || undefined,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  return { ok: true };
}

/**
 * Sends one email through the configured provider and records it in the email log.
 * Never throws: a mail problem must not fail the sign-up, purchase or grant that triggered it.
 */
export async function sendRawEmail(message: Message): Promise<SendResult> {
  let config: EmailConfig | null = null;
  let result: SendResult;
  try {
    config = await getEmailConfig();
    result = await deliver(config, message);
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Unknown email error" };
  }

  const provider = config?.provider ?? "unknown";
  if (provider === "log") {
    // No provider configured yet: surface the message in the server log so local flows are testable.
    const firstLink = message.text.match(/https?:\/\/\S+/)?.[0];
    console.info(`[email:log] to=${message.to} subject="${message.subject}"${firstLink ? ` link=${firstLink}` : ""}`);
  } else if (!result.ok) {
    console.error(`[email] failed to send "${message.subject}" to ${message.to}: ${result.error}`);
  }

  try {
    await db.emailLog.create({
      data: {
        to: message.to,
        subject: message.subject.slice(0, 300),
        template: message.template,
        provider,
        status: !result.ok ? "FAILED" : provider === "log" ? "LOGGED" : "SENT",
        error: result.ok ? null : result.error.slice(0, 1000),
        html: message.html,
      },
    });
  } catch (error) {
    console.error("[email] could not write the email log", error);
  }

  return result;
}

export async function sendEmail(to: string, template: string, content: EmailContent) {
  const rendered = await renderEmail(content);
  return sendRawEmail({ to, template, ...rendered });
}

/** Sends the same email to many recipients, a few at a time. */
export async function sendBulkEmail(recipients: string[], template: string, content: EmailContent) {
  const rendered = await renderEmail(content);
  const unique = [...new Set(recipients.map((address) => address.toLowerCase()))];
  let sent = 0;
  for (let index = 0; index < unique.length; index += 5) {
    const batch = unique.slice(index, index + 5);
    const results = await Promise.all(batch.map((to) => sendRawEmail({ to, template, ...rendered })));
    sent += results.filter((result) => result.ok).length;
  }
  return { sent, total: unique.length };
}
