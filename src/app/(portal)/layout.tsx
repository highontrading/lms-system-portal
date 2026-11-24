import Link from "next/link";
import { Bell, Eye } from "lucide-react";
import { stopViewingAsStudent } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { BottomNav, SidebarNav } from "@/components/portal/shell/nav";
import { UserMenu } from "@/components/portal/shell/user-menu";
import { ThemeToggle } from "@/components/theme/theme";
import { isStaff } from "@/lib/permissions";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

// The shell reads the session and live settings, so entering the portal waits on the server;
// each page inside streams behind its own loading state.
export const instant = false;

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUser();
  const { user } = ctx;
  const [{ general, branding }, unread] = await Promise.all([
    getSettings(),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>
      {/* Sidebar — laptop and wider */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 shrink-0 items-center px-5">
          <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} href="/dashboard" />
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto pt-2 pb-4">
          <SidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {ctx.impersonatorId ? (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-warning-soft px-4 py-2 text-[0.8125rem] font-medium text-warning-text">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4 shrink-0" aria-hidden />
              You are viewing the portal as {user.name}
            </span>
            <form action={stopViewingAsStudent}>
              <button
                type="submit"
                className="rounded-md border border-warning/40 bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-xs transition-colors hover:bg-muted"
              >
                Return to admin
              </button>
            </form>
          </div>
        ) : null}

        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-lg sm:px-6 lg:h-16 lg:px-8">
          <div className="min-w-0 lg:hidden">
            {/* Very narrow phones get the mark only, so the header never overflows. */}
            <Logo
              siteName={general.siteName}
              logoUrl={general.logoUrl}
              logoDarkUrl={general.logoDarkUrl}
              href="/dashboard"
              compact
              className="min-[360px]:hidden"
            />
            <Logo
              siteName={general.siteName}
              logoUrl={general.logoUrl}
              logoDarkUrl={general.logoDarkUrl}
              href="/dashboard"
              className="hidden min-[360px]:inline-flex"
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <Link
              href="/notifications"
              className="relative grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            >
              <Bell className="size-4.5" aria-hidden />
              {unread > 0 ? (
                <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] leading-none font-bold text-white ring-2 ring-background">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <ThemeToggle defaultTheme={branding.defaultTheme} />
            <UserMenu name={user.name} email={user.email} avatarUrl={user.avatarUrl} isStaff={isStaff(user.role)} />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <BottomNav unread={unread} />
    </div>
  );
}
