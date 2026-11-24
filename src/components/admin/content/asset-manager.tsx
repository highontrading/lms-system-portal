"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Code2, File as FileIcon, Link2, Paperclip, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import type { AssetKind } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { cn, formatBytes } from "@/lib/utils";
import { deleteAsset, reorderAssets, saveAsset } from "@/server/admin/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/ui/controls";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";

export type AssetRow = {
  id: string;
  kind: AssetKind;
  title: string;
  description: string | null;
  version: string | null;
  url: string | null;
  fileKey: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
  content: string | null;
  language: string | null;
  downloadCount: number;
};

const KINDS: { value: AssetKind; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "FILE", label: "File", hint: "A download: JSON, ZIP, PDF, template…", icon: FileIcon },
  { value: "LINK", label: "Link", hint: "A page, tool, doc or shared folder", icon: Link2 },
  { value: "SNIPPET", label: "Snippet", hint: "Text to copy: a prompt, code, config", icon: Code2 },
];

const KIND_ICONS: Record<AssetKind, LucideIcon> = { FILE: FileIcon, LINK: Link2, SNIPPET: Code2 };

function hostOf(url: string | null) {
  if (!url) return "";
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function AssetDialog({
  productId,
  lessonId,
  asset,
  showVersion,
  open,
  onOpenChange,
}: {
  productId: string;
  lessonId: string | null;
  asset: AssetRow | null;
  showVersion: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [kind, setKind] = useState<AssetKind>(asset?.kind ?? "FILE");
  const [title, setTitle] = useState(asset?.title ?? "");
  const [description, setDescription] = useState(asset?.description ?? "");
  const [version, setVersion] = useState(asset?.version ?? "");
  const [url, setUrl] = useState(asset?.url ?? "");
  const [content, setContent] = useState(asset?.content ?? "");
  const [language, setLanguage] = useState(asset?.language ?? "");
  const [file, setFile] = useState<{ key: string; name: string; size: number | null; mime: string } | null>(
    asset?.fileKey ? { key: asset.fileKey, name: asset.fileName ?? "File", size: asset.fileSize, mime: asset.mimeType ?? "" } : null,
  );

  const save = useAction(saveAsset, {
    toastError: true,
    success: asset ? "Saved" : "Added",
    onSuccess: () => onOpenChange(false),
  });
  const errors = save.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            save.run({
              productId,
              lessonId,
              assetId: asset?.id,
              kind,
              title,
              description,
              version,
              url,
              content,
              language,
              fileKey: file?.key ?? "",
              fileName: file?.name ?? "",
              fileSize: file?.size ?? null,
              mimeType: file?.mime ?? "",
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{asset ? "Edit item" : "Add a file, link or snippet"}</DialogTitle>
            <DialogDescription>Only people with access can open what you add here.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type">
              {KINDS.map((option) => {
                const selected = option.value === kind;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setKind(option.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors",
                      selected ? "border-primary bg-primary-soft text-primary-text" : "border-border hover:bg-muted",
                    )}
                  >
                    <option.icon className="size-4.5" />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="hidden text-[0.6875rem] leading-tight text-muted-foreground sm:block">{option.hint}</span>
                  </button>
                );
              })}
            </div>

            {kind === "FILE" ? (
              <Field label="File" error={errors.fileKey} hint="Any file up to 5 GB. Replace it later to ship a new version.">
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border-strong bg-subtle/60 p-3">
                  <UploadButton
                    purpose="private"
                    size="sm"
                    onUploaded={(uploaded) => {
                      setFile({ key: uploaded.key, name: uploaded.fileName, size: uploaded.size, mime: uploaded.mimeType });
                      if (!title.trim()) setTitle(uploaded.fileName);
                    }}
                  >
                    <Paperclip /> {file ? "Replace file" : "Choose file"}
                  </UploadButton>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {file ? (
                      <>
                        <span className="font-medium text-foreground">{file.name}</span>
                        {file.size ? ` · ${formatBytes(file.size)}` : ""}
                      </>
                    ) : (
                      "No file chosen yet"
                    )}
                  </span>
                </div>
              </Field>
            ) : null}

            {kind === "LINK" ? (
              <Field label="Link address" htmlFor="asset-url" error={errors.url}>
                <Input
                  id="asset-url"
                  type="url"
                  inputMode="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://"
                />
              </Field>
            ) : null}

            {kind === "SNIPPET" ? (
              <>
                <Field label="Text to copy" htmlFor="asset-content" error={errors.content} hint="Shown in a box with a copy button.">
                  <Textarea
                    id="asset-content"
                    rows={8}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="font-mono text-[0.8125rem]"
                    spellCheck={false}
                  />
                </Field>
                <Field label="Format" htmlFor="asset-language" optional hint="For example: prompt, json, javascript.">
                  <Input id="asset-language" value={language} onChange={(event) => setLanguage(event.target.value)} />
                </Field>
              </>
            ) : null}

            <Field label="Title" htmlFor="asset-title" error={errors.title}>
              <Input
                id="asset-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={kind === "FILE" ? "e.g. Workflow file (n8n)" : kind === "LINK" ? "e.g. Configuration sheet" : "e.g. System prompt"}
                required
              />
            </Field>
            <div className={cn("grid gap-4", showVersion && "sm:grid-cols-[1fr_9rem]")}>
              <Field label="Description" htmlFor="asset-description" optional>
                <Input
                  id="asset-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What it is or how to use it"
                />
              </Field>
              {showVersion ? (
                <Field label="Version" htmlFor="asset-version" optional>
                  <Input id="asset-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.0.0" />
                </Field>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={save.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              {asset ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Files, links and copyable snippets — either a product's deliverables (lessonId null) or the
 * resources attached to one lesson.
 */
export function AssetManager({
  productId,
  lessonId,
  assets,
  title,
  description,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  showVersion = false,
  compact = false,
}: {
  productId: string;
  lessonId: string | null;
  assets: AssetRow[];
  title: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showVersion?: boolean;
  compact?: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; asset: AssetRow | null }>({ open: false, asset: null });
  const [deleting, setDeleting] = useState<AssetRow | null>(null);
  const remove = useAction(deleteAsset, { success: "Removed", onSuccess: () => setDeleting(null) });
  const reorder = useAction(reorderAssets);

  function move(index: number, direction: -1 | 1) {
    const ids = assets.map((asset) => asset.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.run({ productId, lessonId, ids });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("font-display font-semibold tracking-tight", compact ? "text-base" : "text-lg")}>{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button variant={compact ? "secondary" : "primary"} size={compact ? "sm" : "md"} onClick={() => setDialog({ open: true, asset: null })}>
          <Plus /> Add
        </Button>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          compact
          icon={<Paperclip />}
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button variant="soft" size="sm" onClick={() => setDialog({ open: true, asset: null })}>
              <Plus /> Add a file, link or snippet
            </Button>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {assets.map((asset, index) => {
            const Icon = KIND_ICONS[asset.kind];
            return (
              <li key={asset.id} className="flex items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0 sm:px-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{asset.title}</span>
                    {asset.version ? (
                      <Badge variant="neutral" size="sm">
                        v{asset.version.replace(/^v/i, "")}
                      </Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {asset.kind === "FILE"
                      ? [asset.fileName, asset.fileSize ? formatBytes(asset.fileSize) : null, asset.downloadCount ? `${asset.downloadCount} downloads` : null]
                          .filter(Boolean)
                          .join(" · ")
                      : asset.kind === "LINK"
                        ? hostOf(asset.url)
                        : `${asset.language || "Text"} · ${(asset.content ?? "").length.toLocaleString("en")} characters`}
                    {asset.description ? ` — ${asset.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0 || reorder.pending}
                    aria-label={`Move ${asset.title} up`}
                    className="hidden size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 sm:grid"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === assets.length - 1 || reorder.pending}
                    aria-label={`Move ${asset.title} down`}
                    className="hidden size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 sm:grid"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ open: true, asset })}
                    aria-label={`Edit ${asset.title}`}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(asset)}
                    aria-label={`Remove ${asset.title}`}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AssetDialog
        key={`${dialog.asset?.id ?? "new"}-${dialog.open}`}
        productId={productId}
        lessonId={lessonId}
        asset={dialog.asset}
        showVersion={showVersion}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove “${deleting?.title ?? ""}”?`}
        description="Students will no longer see it. An uploaded file stays in your storage."
        confirmLabel="Remove"
        loading={remove.pending}
        onConfirm={async () => {
          if (deleting) await remove.run({ productId, assetId: deleting.id });
        }}
      />
    </div>
  );
}
