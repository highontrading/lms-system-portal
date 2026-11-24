import type { Metadata } from "next";
import { BadgeCheck, ShieldAlert, ShieldX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { formatDate } from "@/lib/utils";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Verify a certificate", robots: { index: false } };

// A public page that reads live data; it has no shell to prerender.
export const instant = false;

/** Public check: is this certificate genuine? No sign-in needed. */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const [{ serial }, { general }] = await Promise.all([params, getSettings()]);
  const cleaned = decodeURIComponent(serial).trim().toUpperCase().slice(0, 40);
  const certificate = /^[A-Z0-9-]+$/.test(cleaned) ? await db.certificate.findUnique({ where: { serial: cleaned } }) : null;
  const date = (value: Date) => formatDate(value, { style: "long", locale: general.locale, timeZone: general.timezone });

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <Logo siteName={general.siteName} logoUrl={general.logoUrl} logoDarkUrl={general.logoDarkUrl} />
      <main className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        {!certificate ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger-text">
              <ShieldX className="size-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Certificate not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t find a certificate with the ID <span className="font-mono text-foreground">{cleaned || "—"}</span>.
              Check the ID and try again.
            </p>
          </>
        ) : certificate.revokedAt ? (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning-soft text-warning-text">
              <ShieldAlert className="size-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">This certificate was revoked</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It was issued to {certificate.studentName} for “{certificate.productTitle}” and revoked on {date(certificate.revokedAt)}.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-success-soft text-success-text">
              <BadgeCheck className="size-7" />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">Verified certificate</h1>
            <p className="mt-2 text-sm text-muted-foreground">This certificate is genuine and was issued by {general.siteName}.</p>
            <dl className="mt-6 divide-y divide-border rounded-xl border border-border text-left text-sm">
              {[
                ["Awarded to", certificate.studentName],
                ["For completing", certificate.productTitle],
                ["Date issued", date(certificate.issuedAt)],
                ["Certificate ID", certificate.serial],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium [overflow-wrap:anywhere]">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </main>
      <p className="mt-6 text-xs text-muted-foreground">Certificate verification · {general.siteName}</p>
    </div>
  );
}
