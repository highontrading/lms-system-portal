import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { MobileNav } from "@/components/admin/shell/mobile-nav";
import { ADMIN_NAV } from "@/components/admin/shell/nav";
import { SidebarNav } from "@/components/admin/shell/sidebar-nav";
import { UserMenu } from "@/components/admin/shell/user-menu";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme";
import { Badge } from "@/components/ui/badge";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/guards";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

// The shell reads the session and settings, so entering the admin area waits on the server;
// each page inside streams behind its own loading state.
export const instant = false;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  // While "viewing as a student" the admin area stays closed, so nothing is changed by accident.
  if (ctx.impersonatorId) redirect("/dashboard");

  const { general, branding } = await getSettings();
  const items = ADMIN_NAV.filter((item) => can(ctx.user.role, item.permission));
  const user = {
    name: ctx.user.name,
    email: ctx.user.email,
    avatarUrl: ctx.user.avatarUrl,
    roleLabel: ROLE_LABELS[ctx.user.role],
  };
  const brand = (
    <div className="flex min-w-0 items-center gap-2">
      <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} href="/admin" compact />
      <span className="truncate font-display text-sm font-semibold tracking-tight">{general.siteName}</span>
      <Badge variant="primary" size="sm">
        Admin
      </Badge>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-4">{brand}</div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav items={items} />
        </div>
        <div className="shrink-0 border-t border-border p-2">
          <UserMenu {...user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-6 lg:px-8">
          <MobileNav items={items} header={brand} />
          <div className="min-w-0 lg:hidden">{brand}</div>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              View site <ExternalLink className="size-3.5" />
            </Link>
            <ThemeToggle defaultTheme={branding.defaultTheme} />
            <div className="lg:hidden">
              <UserMenu {...user} compact />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
