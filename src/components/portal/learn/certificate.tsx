import { Award } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";

export type CertificateData = {
  siteName: string;
  logoUrl: string | null;
  title: string;
  intro: string;
  completionText: string;
  studentName: string;
  productTitle: string;
  issuedOn: string;
  serial: string;
  verifyUrl: string;
  signatureName: string;
  signatureTitle: string;
  signatureImageUrl: string | null;
  style: "classic" | "modern";
};

/**
 * The certificate itself. Sized in container units, so it scales cleanly from a phone
 * screen to an A4 landscape print. Colours are fixed (paper is white in both themes).
 */
export function CertificateArtwork({ data }: { data: CertificateData }) {
  const modern = data.style === "modern";
  return (
    <div className="@container w-full">
      <div
        id="certificate"
        className="relative aspect-[1.414/1] w-full overflow-hidden rounded-[1.2cqw] bg-white text-[#17152a] shadow-lg [print-color-adjust:exact] [-webkit-print-color-adjust:exact]"
        style={{ fontSize: "1.55cqw" }}
      >
        {modern ? (
          <>
            <div className="absolute inset-y-0 left-0 w-[26%]" style={{ background: "linear-gradient(160deg, var(--brand), color-mix(in oklab, var(--brand) 55%, #0d0b1c))" }} />
            <div className="absolute top-[9%] left-[5%] text-white">
              <Award style={{ width: "9cqw", height: "9cqw" }} strokeWidth={1.2} />
            </div>
            <div className="absolute bottom-[8%] left-[4%] w-[18%] text-[0.9em] leading-snug text-white/80">
              <p className="font-semibold text-white">{data.siteName}</p>
              <p className="mt-[0.4em] font-mono text-[0.85em]">ID {data.serial}</p>
            </div>
          </>
        ) : (
          <>
            <div className="absolute inset-[2.2%] rounded-[0.8cqw] border-[0.35cqw]" style={{ borderColor: "var(--brand)" }} />
            <div className="absolute inset-[3.6%] rounded-[0.5cqw] border-[0.1cqw] border-[#17152a]/25" />
            <div className="absolute -top-[14%] -right-[8%] aspect-square w-[34%] rounded-full opacity-[0.07]" style={{ background: "var(--brand)" }} />
            <div className="absolute -bottom-[16%] -left-[9%] aspect-square w-[38%] rounded-full opacity-[0.07]" style={{ background: "var(--brand)" }} />
          </>
        )}

        <div className={modern ? "absolute inset-y-0 right-0 flex w-[74%] flex-col justify-center px-[6%] py-[6%]" : "absolute inset-0 flex flex-col items-center px-[10%] py-[7.5%] text-center"}>
          <div className={modern ? "flex items-center gap-[0.8em]" : "flex items-center justify-center gap-[0.8em]"}>
            {data.logoUrl ? (
              <img src={data.logoUrl} alt={data.siteName} style={{ height: "4.2cqw" }} className="w-auto object-contain" />
            ) : (
              <>
                <LogoMark className="size-[4.2cqw]" />
                <span className="font-display text-[1.5em] font-bold tracking-tight">{data.siteName}</span>
              </>
            )}
          </div>

          <p className={modern ? "mt-[5%] text-[1em] font-semibold tracking-[0.28em] uppercase" : "mt-[4.5%] text-[1em] font-semibold tracking-[0.32em] uppercase"} style={{ color: "var(--brand)" }}>
            {data.title}
          </p>
          <p className="mt-[3%] text-[1.1em] text-[#17152a]/65">{data.intro}</p>
          <p className="mt-[1.2%] font-display text-[3.6em] leading-[1.1] font-bold tracking-tight [overflow-wrap:anywhere]">{data.studentName}</p>
          <div className={modern ? "mt-[2%] h-[0.22cqw] w-[18%]" : "mx-auto mt-[2%] h-[0.22cqw] w-[18%]"} style={{ background: "var(--spark)" }} />
          <p className="mt-[2.4%] text-[1.1em] text-[#17152a]/65">{data.completionText}</p>
          <p className="mt-[1%] font-display text-[1.9em] leading-[1.2] font-semibold [overflow-wrap:anywhere]">{data.productTitle}</p>

          <div className={modern ? "mt-auto flex items-end justify-between gap-[4%] pt-[4%]" : "mt-auto flex w-full items-end justify-between gap-[4%] pt-[3%]"}>
            <div className="min-w-0 text-left">
              <p className="font-display text-[1.25em] font-semibold">{data.issuedOn}</p>
              <div className="mt-[0.5em] h-px w-[14cqw] bg-[#17152a]/30" />
              <p className="mt-[0.5em] text-[0.9em] text-[#17152a]/60">Date issued</p>
            </div>

            {modern ? null : (
              <div className="grid aspect-square w-[9.5cqw] shrink-0 place-items-center rounded-full text-white" style={{ background: "var(--brand)", boxShadow: "0 0 0 0.5cqw color-mix(in oklab, var(--brand) 22%, white)" }}>
                <Award style={{ width: "5cqw", height: "5cqw" }} strokeWidth={1.4} />
              </div>
            )}

            <div className="min-w-0 text-right">
              {data.signatureImageUrl ? (
                <img src={data.signatureImageUrl} alt="" style={{ height: "4.6cqw" }} className="ml-auto w-auto object-contain" />
              ) : (
                <p className="font-display text-[1.25em] font-semibold">{data.signatureName || data.siteName}</p>
              )}
              <div className="mt-[0.5em] ml-auto h-px w-[14cqw] bg-[#17152a]/30" />
              <p className="mt-[0.5em] text-[0.9em] text-[#17152a]/60">
                {data.signatureImageUrl && data.signatureName ? `${data.signatureName}${data.signatureTitle ? `, ${data.signatureTitle}` : ""}` : data.signatureTitle || "Authorised by"}
              </p>
            </div>
          </div>

          {modern ? (
            <p className="mt-[3%] text-[0.8em] text-[#17152a]/55">Verify at {data.verifyUrl}</p>
          ) : (
            <p className="mt-[2.2%] text-[0.8em] text-[#17152a]/55">
              Certificate ID <span className="font-mono">{data.serial}</span> · Verify at {data.verifyUrl}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Print rules: only the certificate, edge to edge, on one landscape page. */
export const CERTIFICATE_PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  #certificate, #certificate * { visibility: visible !important; }
  #certificate { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; aspect-ratio: auto !important; border-radius: 0 !important; box-shadow: none !important; }
}`;
