import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { dayKey } from "@/lib/dates";
import { LocalTime } from "@/components/local-time";
import { SessionCard, sessionPhase } from "@/components/portal/learn/session-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth/guards";
import { getLiveSessionsForUser } from "@/server/portal/learning";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

export const metadata: Metadata = { title: "Live sessions" };

export default async function LiveSessionsPage() {
  const [{ user }, { general }] = await Promise.all([requireUser(), getSettings()]);
  const sessions = await getLiveSessionsForUser(user.id);
  const now = new Date();

  const upcoming = sessions.filter((session) => ["upcoming", "live"].includes(sessionPhase(session, now)));
  const past = sessions
    .filter((session) => sessionPhase(session, now) === "past")
    .reverse()
    .slice(0, 30);

  // Group by calendar day so a busy week reads like an agenda.
  const days = new Map<string, typeof upcoming>();
  for (const session of upcoming) {
    const key = dayKey(session.startsAt, general.timezone);
    days.set(key, [...(days.get(key) ?? []), session]);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Live sessions" description="Every upcoming session across the things you own, shown in your own time zone." />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="No upcoming sessions"
          description={
            sessions.length === 0
              ? "When a workshop or program you own schedules a live session, it will appear here."
              : "You're all caught up. Replays of past sessions are below."
          }
          action={
            <Button asChild variant="secondary">
              <Link href="/library">Go to my library</Link>
            </Button>
          }
          compact={past.length > 0}
        />
      ) : (
        <div className="grid gap-7">
          {[...days.entries()].map(([key, items]) => (
            <section key={key}>
              <h2 className="mb-3 flex items-center gap-2 text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                <LocalTime date={items[0].startsAt} format="day" fallbackZone={general.timezone} />
              </h2>
              <div className="grid gap-3">
                {items.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    productTitle={session.product.title}
                    pageUrl={absoluteUrl(`/learn/${session.product.slug}?tab=live`)}
                    timeZone={general.timezone}
                    now={now}
                    showProduct
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {past.length > 0 ? (
        <section className="mt-10">
          <SectionHeading title="Past sessions" description="Catch up with the replays." />
          <div className="grid gap-3">
            {past.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                productTitle={session.product.title}
                pageUrl={absoluteUrl(`/learn/${session.product.slug}?tab=live`)}
                timeZone={general.timezone}
                now={now}
                showProduct
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
