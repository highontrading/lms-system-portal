import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionsManager } from "@/components/admin/content/sessions-manager";
import { addDays, toLocalInputValue } from "@/lib/dates";
import { formatDateTime } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Live sessions" };

export default async function ProductSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("products.manage");
  const { id } = await params;

  const [product, { general }] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: {
        id: true,
        liveSessions: { orderBy: { startsAt: "asc" }, include: { _count: { select: { attendances: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!product) notFound();

  const now = new Date();
  const timeZone = general.timezone;
  // New sessions default to tomorrow evening in the site's time zone.
  const defaultStart = `${toLocalInputValue(addDays(now, 1), timeZone).slice(0, 10)}T19:00`;

  return (
    <SessionsManager
      productId={product.id}
      timeZone={timeZone}
      defaultStart={defaultStart}
      sessions={product.liveSessions.map((session) => ({
        id: session.id,
        title: session.title,
        description: session.description ?? "",
        startsAtLocal: toLocalInputValue(session.startsAt, timeZone),
        startsAtLabel: formatDateTime(session.startsAt, { timeZone, locale: general.locale, withZone: true }),
        isPast: session.startsAt.getTime() + session.durationMinutes * 60_000 < now.getTime(),
        durationMinutes: session.durationMinutes,
        platform: session.platform ?? "",
        meetingUrl: session.meetingUrl ?? "",
        meetingPasscode: session.meetingPasscode ?? "",
        status: session.status,
        recordingProvider: session.recordingProvider,
        recordingUrl: session.recordingUrl ?? "",
        attendees: session._count.attendances,
      }))}
    />
  );
}
