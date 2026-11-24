import { SiteFooter, SiteHeader } from "@/components/site/chrome";
import { isStaff } from "@/lib/permissions";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

// Reads live settings and the session, so entering this layout waits on the server.
export const instant = false;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, session, pages] = await Promise.all([
    getSettings(),
    getSession(),
    db.page.findMany({
      where: { isPublished: true, showInFooter: true },
      orderBy: { position: "asc" },
      select: { slug: true, title: true },
    }),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader settings={settings} signedIn={!!session} isStaff={!!session && isStaff(session.user.role)} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} pages={pages} />
    </div>
  );
}
