import { notFound } from "next/navigation";
import { PlayerShell } from "@/components/player/shell";
import { requireUser } from "@/server/auth/guards";
import { getLearningContext } from "@/server/portal/learning";
import { getSettings } from "@/server/settings";

// Loads the course outline for the viewer, so entering the player waits on the server once;
// moving between lessons then only swaps the lesson area.
export const instant = false;

export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, { user }, { branding }] = await Promise.all([params, requireUser(), getSettings()]);
  const ctx = await getLearningContext(slug, user);
  if (!ctx) notFound();

  return (
    <PlayerShell
      slug={slug}
      title={ctx.product.title}
      percent={ctx.percent}
      completedCount={ctx.completedCount}
      totalLessons={ctx.totalLessons}
      showProgress={ctx.hasAccess}
      defaultTheme={branding.defaultTheme}
      sections={ctx.sections.map((section) => ({
        id: section.id,
        title: section.title,
        lessons: section.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          durationSeconds: lesson.durationSeconds,
          completed: ctx.completedLessonIds.has(lesson.id),
          lock: ctx.locks[lesson.id] ?? { locked: false },
        })),
      }))}
    >
      {children}
    </PlayerShell>
  );
}
