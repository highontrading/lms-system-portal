import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RichText } from "@/components/content";
import { db } from "@/server/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await db.page.findUnique({ where: { slug }, select: { title: true, seoDescription: true, isPublished: true } });
  if (!page?.isPublished) return { title: "Not found" };
  return { title: page.title, description: page.seoDescription ?? undefined };
}

/** Pages written in Admin → Pages (About, Terms, Privacy…). */
export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const page = await db.page.findUnique({ where: { slug } });
  if (!page || !page.isPublished) notFound();

  return (
    <article className="container-page max-w-3xl py-12 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{page.title}</h1>
      <RichText html={page.body} className="mt-8" />
    </article>
  );
}
