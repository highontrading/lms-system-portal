import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/dialog";
import type { Settings } from "@/lib/settings-schema";
import { safeHref } from "@/lib/utils";

type HeaderProps = {
  settings: Pick<Settings, "general" | "branding" | "navigation">;
  signedIn: boolean;
  isStaff: boolean;
};

export function SiteHeader({ settings, signedIn, isStaff }: HeaderProps) {
  const { general, branding, navigation } = settings;
  const links = navigation.headerLinks.filter((link) => safeHref(link.href));

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} />
        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={safeHref(link.href)!}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle defaultTheme={branding.defaultTheme} />
          {signedIn ? (
            <>
              {isStaff ? (
                <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <Button asChild size="sm">
                <Link href="/dashboard">My learning</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <Sheet>
            <SheetTrigger
              className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" title="Menu">
              <nav className="mt-4 grid gap-1 px-3" aria-label="Mobile">
                {links.map((link) => (
                  <SheetClose asChild key={`${link.href}-${link.label}`}>
                    <Link href={safeHref(link.href)!} className="rounded-md px-3 py-3 text-[0.9375rem] font-medium hover:bg-muted">
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <Link href={signedIn ? "/dashboard" : "/login"} className="rounded-md px-3 py-3 text-[0.9375rem] font-medium hover:bg-muted">
                    {signedIn ? "My learning" : "Sign in"}
                  </Link>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({
  settings,
  pages,
}: {
  settings: Pick<Settings, "general" | "navigation">;
  pages: { slug: string; title: string }[];
}) {
  const { general, navigation } = settings;
  const social = Object.entries(general.social).filter(([, url]) => safeHref(url));
  const links = [
    { label: "Catalog", href: "/catalog" },
    ...pages.map((page) => ({ label: page.title, href: `/${page.slug}` })),
    ...navigation.footerLinks.filter((link) => safeHref(link.href)),
  ];

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.4fr_1fr]">
        <div className="max-w-sm">
          <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} />
          {general.footerText ? <p className="mt-3 text-sm text-muted-foreground">{general.footerText}</p> : null}
          {general.supportEmail ? (
            <a href={`mailto:${general.supportEmail}`} className="mt-3 inline-block text-sm font-medium text-primary-text hover:underline">
              {general.supportEmail}
            </a>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {links.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="text-muted-foreground hover:text-foreground">
              {link.label}
            </Link>
          ))}
          {social.map(([name, url]) => (
            <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-muted-foreground hover:text-foreground">
              {name}
            </a>
          ))}
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {general.siteName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
