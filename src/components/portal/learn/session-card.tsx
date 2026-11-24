import { CalendarPlus, Download, KeyRound, Video } from "lucide-react";
import type { LiveStatus, VideoProvider } from "@/generated/prisma/enums";
import { stripHtml } from "@/lib/utils";
import { LocalTime } from "@/components/local-time";
import { JoinSessionButton, ReplayButton } from "@/components/portal/learn/live";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/controls";

export type SessionView = {
  id: string;
  title: string;
  description: string | null;
  startsAt: Date;
  durationMinutes: number;
  platform: string | null;
  meetingPasscode: string | null;
  status: LiveStatus;
  recordingProvider: VideoProvider | null;
  recordingUrl: string | null;
};

export type SessionPhase = "upcoming" | "live" | "past" | "cancelled";

export function sessionPhase(session: Pick<SessionView, "startsAt" | "durationMinutes" | "status">, now: Date): SessionPhase {
  if (session.status === "CANCELLED") return "cancelled";
  const start = session.startsAt.getTime();
  const end = start + session.durationMinutes * 60_000;
  if (session.status === "ENDED" || now.getTime() > end) return "past";
  if (session.status === "LIVE" || now.getTime() >= start) return "live";
  return "upcoming";
}

function calendarStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function googleCalendarUrl(session: SessionView, productTitle: string, pageUrl: string) {
  const end = new Date(session.startsAt.getTime() + session.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${session.title} — ${productTitle}`,
    dates: `${calendarStamp(session.startsAt)}/${calendarStamp(end)}`,
    details: `${stripHtml(session.description).slice(0, 400)}\n\nJoin from: ${pageUrl}`.trim(),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** One live session: when it is (in the viewer's own time zone), how to join, and the replay afterwards. */
export function SessionCard({
  session,
  productTitle,
  pageUrl,
  timeZone,
  now,
  showProduct,
}: {
  session: SessionView;
  productTitle: string;
  /** Absolute URL of the page students join from (used in calendar entries). */
  pageUrl: string;
  timeZone: string;
  now: Date;
  showProduct?: boolean;
}) {
  const phase = sessionPhase(session, now);
  const description = stripHtml(session.description);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="hidden w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary-soft py-2 text-primary-text sm:flex" aria-hidden>
          <span className="text-[0.6875rem] font-semibold tracking-wide uppercase">
            {new Intl.DateTimeFormat("en", { month: "short", timeZone }).format(session.startsAt)}
          </span>
          <span className="font-display text-xl leading-none font-bold">
            {new Intl.DateTimeFormat("en", { day: "numeric", timeZone }).format(session.startsAt)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {phase === "live" ? (
              <Badge variant="danger">
                <span className="size-1.5 animate-pulse-ring rounded-full bg-danger" /> Live now
              </Badge>
            ) : phase === "upcoming" ? (
              <Badge variant="primary">Upcoming</Badge>
            ) : phase === "cancelled" ? (
              <Badge variant="warning">Cancelled</Badge>
            ) : (
              <Badge>Ended</Badge>
            )}
            {showProduct ? <span className="truncate text-xs text-muted-foreground">{productTitle}</span> : null}
          </div>
          <h3 className="mt-1.5 font-display text-base leading-snug font-semibold">{session.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <LocalTime date={session.startsAt} format="weekday-datetime" showZone fallbackZone={timeZone} className="font-medium text-foreground" />
            <span aria-hidden>·</span>
            <span>{session.durationMinutes} min</span>
            {session.platform ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <Video className="size-3.5" /> {session.platform}
                </span>
              </>
            ) : null}
          </p>
          {description ? <p className="mt-1.5 line-clamp-2 text-[0.8125rem] text-muted-foreground">{description}</p> : null}
          {session.meetingPasscode && (phase === "upcoming" || phase === "live") ? (
            <p className="mt-2 inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
              <KeyRound className="size-3.5" /> Passcode
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{session.meetingPasscode}</code>
              <CopyButton value={session.meetingPasscode} iconOnly size="xs" variant="ghost" label="Copy passcode" />
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {phase === "upcoming" || phase === "live" ? (
          <>
            <JoinSessionButton sessionId={session.id} startsAt={session.startsAt.toISOString()} durationMinutes={session.durationMinutes} />
            <Button asChild variant="ghost" size="icon" aria-label="Add to Google Calendar">
              <a href={googleCalendarUrl(session, productTitle, pageUrl)} target="_blank" rel="noopener noreferrer" title="Add to Google Calendar">
                <CalendarPlus />
              </a>
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Download calendar file">
              <a href={`/api/live/${session.id}/calendar.ics`} title="Download calendar file (.ics)">
                <Download />
              </a>
            </Button>
          </>
        ) : phase === "past" ? (
          session.recordingProvider && session.recordingUrl ? (
            <ReplayButton provider={session.recordingProvider} url={session.recordingUrl} title={session.title} />
          ) : (
            <span className="text-[0.8125rem] text-muted-foreground">Recording coming soon</span>
          )
        ) : null}
      </div>
    </div>
  );
}
