import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock, NotebookPen } from "lucide-react";
import { formatClock, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "My notes" };

export default async function NotesPage() {
  const [{ user }, { general }] = await Promise.all([requireUser(), getSettings()]);
  const notes = await db.note.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { lesson: { select: { id: true, title: true, product: { select: { slug: true, title: true } } } } },
  });

  // Product → lesson → notes, keeping the newest activity first.
  const products = new Map<string, { title: string; lessons: Map<string, { title: string; notes: typeof notes }> }>();
  for (const note of notes) {
    const slug = note.lesson.product.slug;
    const product = products.get(slug) ?? { title: note.lesson.product.title, lessons: new Map() };
    const lesson = product.lessons.get(note.lesson.id) ?? { title: note.lesson.title, notes: [] };
    lesson.notes.push(note);
    product.lessons.set(note.lesson.id, lesson);
    products.set(slug, product);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My notes" description="Everything you've written while learning. Notes are private to you." />

      {notes.length === 0 ? (
        <EmptyState
          icon={<NotebookPen />}
          title="No notes yet"
          description="Open any lesson and use the “My notes” tab to jot things down. They'll all be collected here."
          action={
            <Button asChild>
              <Link href="/library">Go to my library</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-8">
          {[...products.entries()].map(([slug, product]) => (
            <section key={slug}>
              <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">
                <Link href={`/learn/${slug}`} className="hover:text-primary-text">
                  {product.title}
                </Link>
              </h2>
              <div className="grid gap-4">
                {[...product.lessons.entries()].map(([lessonId, lesson]) => (
                  <div key={lessonId} className="overflow-hidden rounded-xl border border-border bg-card">
                    <Link
                      href={`/learn/${slug}/lesson/${lessonId}`}
                      className="flex items-center justify-between gap-3 border-b border-border bg-subtle px-4 py-2.5 text-sm font-semibold transition-colors hover:text-primary-text"
                    >
                      <span className="min-w-0 truncate">{lesson.title}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                    <ul className="divide-y divide-border">
                      {lesson.notes.map((note) => (
                        <li key={note.id} className="px-4 py-3">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{note.body}</p>
                          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {note.positionSeconds !== null ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 font-medium text-primary-text tabular-nums">
                                <Clock className="size-3" /> {formatClock(note.positionSeconds)}
                              </span>
                            ) : null}
                            {formatDate(note.createdAt, { locale: general.locale, timeZone: general.timezone })}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
