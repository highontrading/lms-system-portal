import "server-only";
import { readableOn } from "@/lib/theme";
import { loadSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

export type EmailContent = {
  subject: string;
  /** Short line shown next to the subject in most inboxes. */
  preheader?: string;
  heading: string;
  /** Plain-text paragraphs. They are HTML-escaped. */
  paragraphs?: string[];
  /** Trusted, already-sanitised HTML (e.g. an announcement body written in the admin editor). */
  html?: string;
  /** A large code to copy, such as a sign-in code or licence key. */
  code?: string;
  details?: [label: string, value: string][];
  button?: { label: string; url: string };
  footnote?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Wraps content in the branded, mobile-friendly email layout. */
export async function renderEmail(content: EmailContent): Promise<RenderedEmail> {
  const { general, branding } = await loadSettings();
  const brand = branding.brandColor;
  const brandText = readableOn(brand);
  const siteName = escapeHtml(general.siteName);
  const logo = general.logoUrl
    ? `<img src="${escapeHtml(absoluteUrl(general.logoUrl))}" alt="${siteName}" height="36" style="display:block;height:36px;width:auto;border:0" />`
    : `<span style="font:700 20px ${FONT};color:#14121f;letter-spacing:-0.02em">${siteName}</span>`;

  const paragraphs = (content.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:400 16px/1.6 ${FONT};color:#3f3d4d">${escapeHtml(p).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const rich = content.html
    ? `<div style="margin:0 0 16px;font:400 16px/1.6 ${FONT};color:#3f3d4d">${content.html}</div>`
    : "";

  const code = content.code
    ? `<div style="margin:8px 0 24px;padding:18px 16px;border-radius:12px;background:#f4f3fa;text-align:center;font:700 30px/1 'SFMono-Regular',Consolas,Menlo,monospace;letter-spacing:0.22em;color:#14121f">${escapeHtml(content.code)}</div>`
    : "";

  const details = content.details?.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;border:1px solid #e8e6f0;border-radius:12px;border-collapse:separate">${content.details
        .map(
          ([label, value], index) =>
            `<tr><td style="padding:12px 16px;font:400 14px ${FONT};color:#6f6c80;${index ? "border-top:1px solid #e8e6f0;" : ""}">${escapeHtml(label)}</td><td align="right" style="padding:12px 16px;font:600 14px ${FONT};color:#14121f;${index ? "border-top:1px solid #e8e6f0;" : ""}">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const button = content.button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${brand}"><a href="${escapeHtml(content.button.url)}" style="display:inline-block;padding:14px 26px;font:600 16px ${FONT};color:${brandText};text-decoration:none;border-radius:10px">${escapeHtml(content.button.label)}</a></td></tr></table><p style="margin:0 0 16px;font:400 13px/1.5 ${FONT};color:#8b889b">If the button doesn't work, copy this link into your browser:<br /><a href="${escapeHtml(content.button.url)}" style="color:#6f6c80;word-break:break-all">${escapeHtml(content.button.url)}</a></p>`
    : "";

  const footnote = content.footnote
    ? `<p style="margin:16px 0 0;font:400 13px/1.5 ${FONT};color:#8b889b">${escapeHtml(content.footnote)}</p>`
    : "";

  const support = general.supportEmail
    ? ` · <a href="mailto:${escapeHtml(general.supportEmail)}" style="color:#8b889b">${escapeHtml(general.supportEmail)}</a>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f5fb">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(content.preheader ?? content.heading)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f5fb">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
<tr><td style="padding:0 8px 20px">${logo}</td></tr>
<tr><td style="padding:32px 28px;background:#ffffff;border:1px solid #e8e6f0;border-radius:16px">
<h1 style="margin:0 0 16px;font:700 24px/1.25 ${FONT};color:#14121f;letter-spacing:-0.02em">${escapeHtml(content.heading)}</h1>
${paragraphs}${rich}${code}${details}${button}${footnote}
</td></tr>
<tr><td style="padding:20px 8px 0;font:400 12px/1.6 ${FONT};color:#8b889b">
Sent by ${siteName}${support}<br />
<a href="${escapeHtml(absoluteUrl("/account"))}" style="color:#8b889b">Manage email preferences</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    ...(content.paragraphs ?? []),
    content.html ? content.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "",
    content.code ? `Code: ${content.code}` : "",
    ...(content.details ?? []).map(([label, value]) => `${label}: ${value}`),
    content.button ? `${content.button.label}: ${content.button.url}` : "",
    content.footnote ?? "",
    "",
    `— ${general.siteName}`,
  ]
    .filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
    .join("\n");

  return { subject: content.subject, html, text };
}
