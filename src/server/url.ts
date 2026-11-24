import { headers } from "next/headers";

/** Public base URL of the site, without a trailing slash. */
export function appUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isSecureSite() {
  return appUrl().startsWith("https://");
}

/** IP and user agent of the current request. Safe to call from actions, route handlers and pages. */
export async function requestMeta() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    return {
      ip: forwarded || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/** Path of the page being rendered, forwarded by the proxy. */
export async function currentPath() {
  try {
    return (await headers()).get("x-pathname") ?? "/";
  } catch {
    return "/";
  }
}
