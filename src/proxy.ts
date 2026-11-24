import { NextResponse, type NextRequest } from "next/server";

// Keep in sync with SESSION_COOKIE in src/server/auth/session.ts (not imported: the proxy stays dependency-free).
const SESSION_COOKIE = "ia_session";

/** Areas that require a signed-in user. */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/library",
  "/learn",
  "/live",
  "/certificates",
  "/notes",
  "/notifications",
  "/orders",
  "/support",
  "/account",
  "/announcements",
  "/checkout",
  "/admin",
];

/**
 * Optimistic gate only: visitors without a session cookie are sent to the login page with a
 * real redirect before any rendering starts. The session itself is verified against the
 * database in the data layer on every page and action.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (needsAuth && !request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  // Tell server components which page is being rendered (used for post-login return paths).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname + search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|files/|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)"],
};
