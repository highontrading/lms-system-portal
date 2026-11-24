import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isStaff } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";
import { CERTIFICATE_PRINT_CSS, CertificateArtwork } from "@/components/portal/learn/certificate";
import { PrintButton } from "@/components/portal/learn/print-button";
import { CopyButton } from "@/components/ui/controls";
import { Callout } from "@/components/ui/misc";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/url";

export const metadata: Metadata = { title: "Certificate", robots: { index: false } };

export default async function CertificatePage({ params }: { params: Promise<{ serial: string }> }) {
  const [{ serial }, { user }, settings] = await Promise.all([params, requireUser(), getSettings()]);
  const certificate = await db.certificate.findUnique({ where: { serial } });
  if (!certificate || (certificate.userId !== user.id && !isStaff(user.role))) notFound();

  const verifyUrl = absoluteUrl(`/verify/${certificate.serial}`);
  const { general, certificate: design } = settings;

  return (
    <div className="mx-auto max-w-4xl">
      <style dangerouslySetInnerHTML={{ __html: CERTIFICATE_PRINT_CSS }} />
      <PageHeader
        back={{ href: "/certificates", label: "All certificates" }}
        title={certificate.productTitle}
        description={`Issued to ${certificate.studentName} on ${formatDate(certificate.issuedAt, { style: "long", locale: general.locale, timeZone: general.timezone })}`}
        actions={
          <>
            <CopyButton value={verifyUrl} label="Copy verification link" size="md" toastMessage="Verification link copied" />
            <PrintButton />
          </>
        }
      />

      {certificate.revokedAt ? (
        <Callout tone="warning" className="mb-4" title="This certificate has been revoked">
          {certificate.revokeReason ?? "It no longer verifies as valid."}
        </Callout>
      ) : null}

      <CertificateArtwork
        data={{
          siteName: general.siteName,
          logoUrl: general.logoUrl || null,
          title: design.title,
          intro: design.intro,
          completionText: design.completionText,
          studentName: certificate.studentName,
          productTitle: certificate.productTitle,
          issuedOn: formatDate(certificate.issuedAt, { style: "long", locale: general.locale, timeZone: general.timezone }),
          serial: certificate.serial,
          verifyUrl: verifyUrl.replace(/^https?:\/\//, ""),
          signatureName: design.signatureName,
          signatureTitle: design.signatureTitle,
          signatureImageUrl: design.signatureImageUrl || null,
          style: design.style,
        }}
      />

      <p className="mt-4 flex items-start gap-2 text-[0.8125rem] text-muted-foreground" data-print="hide">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        Anyone can confirm this certificate is genuine at{" "}
        <a href={verifyUrl} className="font-medium text-primary-text underline underline-offset-2 [overflow-wrap:anywhere]">
          {verifyUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>
    </div>
  );
}
