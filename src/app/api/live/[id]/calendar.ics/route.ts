import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { getLearningContext } from "@/server/portal/learning";
import { absoluteUrl } from "@/server/url";

function stamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** Calendar file for one live session, for students who have access to its product. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, auth] = await Promise.all([params, getSession()]);
  if (!auth) return new Response("Please sign in.", { status: 401 });

  const session = await db.liveSession.findUnique({
    where: { id },
    include: { product: { select: { slug: true, title: true } } },
  });
  if (!session) return new Response("Not found", { status: 404 });

  const ctx = await getLearningContext(session.product.slug, auth.user);
  if (!ctx || !ctx.hasAccess) return new Response("You don't have access to this session.", { status: 403 });

  const end = new Date(session.startsAt.getTime() + session.durationMinutes * 60_000);
  const pageUrl = absoluteUrl(`/learn/${session.product.slug}?tab=live`);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Academy//Live sessions//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:live-${session.id}@academy`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(session.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(`${session.title} — ${session.product.title}`)}`,
    `DESCRIPTION:${escapeText(`Join from your portal: ${pageUrl}`)}`,
    `URL:${pageUrl}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(session.title)} starts in 15 minutes`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${session.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
