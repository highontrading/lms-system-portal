import { ExternalLink, FileDown, Link2, SquareCode } from "lucide-react";
import type { AssetKind } from "@/generated/prisma/enums";
import { formatBytes, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/controls";

export type AssetView = {
  id: string;
  kind: AssetKind;
  title: string;
  description: string | null;
  url: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  content: string | null;
  language: string | null;
  version: string | null;
};

/** Deliverables: files to download, links to open and snippets to copy. */
export function AssetList({ assets }: { assets: AssetView[] }) {
  if (assets.length === 0) return null;
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {assets.map((asset) => {
        const href = asset.kind === "LINK" ? safeHref(asset.url) : null;
        return (
          <li key={asset.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                {asset.kind === "FILE" ? <FileDown className="size-5" /> : asset.kind === "LINK" ? <Link2 className="size-5" /> : <SquareCode className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  <span className="[overflow-wrap:anywhere]">{asset.title}</span>
                  {asset.version ? <Badge size="sm">v{asset.version}</Badge> : null}
                </p>
                {asset.description ? <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{asset.description}</p> : null}
                {asset.kind === "FILE" ? (
                  <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {asset.fileName}
                    {asset.fileSize ? ` · ${formatBytes(asset.fileSize)}` : ""}
                  </p>
                ) : null}
              </div>
              {asset.kind === "FILE" && asset.fileKey ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={`/files/${asset.fileKey}?download=1`} download={asset.fileName ?? true}>
                    <FileDown /> Download
                  </a>
                </Button>
              ) : null}
              {asset.kind === "LINK" && href ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    Open <ExternalLink />
                  </a>
                </Button>
              ) : null}
              {asset.kind === "SNIPPET" && asset.content ? (
                <CopyButton value={asset.content} toastMessage="Copied to clipboard" />
              ) : null}
            </div>
            {asset.kind === "SNIPPET" && asset.content ? (
              <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-[oklch(0.2_0.025_284)] p-3.5 font-mono text-xs leading-relaxed text-[oklch(0.94_0.01_285)]">
                <code>{asset.content}</code>
              </pre>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
