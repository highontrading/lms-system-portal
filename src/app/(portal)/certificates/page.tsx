import type { Metadata } from "next";
import Link from "next/link";
import { Award, Lock } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const [{ user }, { general }] = await Promise.all([requireUser(), getSettings()]);
  const now = new Date();
  const [certificates, enrollments] = await Promise.all([
    db.certificate.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { issuedAt: "desc" } }),
    db.enrollment.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        product: { certificateEnabled: true, status: { not: "DRAFT" } },
      },
      select: {
        progressPercent: true,
        product: { select: { id: true, slug: true, title: true, completionPercent: true } },
      },
      orderBy: { progressPercent: "desc" },
    }),
  ]);
  const earned = new Set(certificates.map((certificate) => certificate.productId));
  const inProgress = enrollments.filter((enrollment) => !earned.has(enrollment.product.id));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Certificates" description="Proof of what you've completed. Each one has a public link anyone can use to verify it." />

      {certificates.length === 0 && inProgress.length === 0 ? (
        <EmptyState
          icon={<Award />}
          title="No certificates yet"
          description="Programs that offer a certificate issue one automatically when you complete them."
          action={
            <Button asChild>
              <Link href="/library">Go to my library</Link>
            </Button>
          }
        />
      ) : null}

      {certificates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {certificates.map((certificate) => (
            <Link
              key={certificate.id}
              href={`/certificates/${certificate.serial}`}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary-soft transition-transform group-hover:scale-110" aria-hidden />
              <span className="relative grid size-11 place-items-center rounded-full bg-spark text-spark-fg">
                <Award className="size-5.5" />
              </span>
              <p className="relative mt-4 font-display text-lg leading-snug font-semibold">{certificate.productTitle}</p>
              <p className="relative mt-1 text-sm text-muted-foreground">
                Issued {formatDate(certificate.issuedAt, { style: "long", locale: general.locale, timeZone: general.timezone })}
              </p>
              <p className="relative mt-3 font-mono text-xs text-muted-foreground">ID {certificate.serial}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {inProgress.length > 0 ? (
        <section className={certificates.length > 0 ? "mt-10" : ""}>
          <SectionHeading title="Still to earn" description="Finish these to unlock their certificates." />
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((enrollment) => (
              <Link
                key={enrollment.product.id}
                href={`/learn/${enrollment.product.slug}`}
                className="flex items-center gap-4 rounded-xl border border-dashed border-border-strong bg-card/60 p-4 transition-colors hover:bg-card"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Lock className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{enrollment.product.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={enrollment.progressPercent} size="sm" />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {enrollment.progressPercent}% of {enrollment.product.completionPercent}%
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
