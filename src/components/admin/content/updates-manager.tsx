"use client";

import { useState } from "react";
import { History, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { deleteProductUpdate, saveProductUpdate } from "@/server/admin/content";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Checkbox, Field, Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";

export type UpdateRow = {
  id: string;
  version: string;
  title: string;
  /** Sanitised HTML. */
  body: string;
  publishedLabel: string;
};

function UpdateDialog({
  productId,
  update,
  currentVersion,
  audience,
  open,
  onOpenChange,
}: {
  productId: string;
  update: UpdateRow | null;
  currentVersion: string;
  audience: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [version, setVersion] = useState(update?.version ?? "");
  const [title, setTitle] = useState(update?.title ?? "");
  const [body, setBody] = useState(update?.body ?? "");
  const [notifyStudents, setNotifyStudents] = useState(true);
  const [emailStudents, setEmailStudents] = useState(false);

  const save = useAction(saveProductUpdate, {
    success: (data) =>
      update ? "Update saved" : data.notified > 0 ? `Published — ${data.notified} ${data.notified === 1 ? "student" : "students"} notified` : "Update published",
    onSuccess: () => onOpenChange(false),
  });
  const errors = save.fieldErrors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            save.run({
              productId,
              updateId: update?.id,
              version,
              title,
              body,
              notifyStudents: update ? false : notifyStudents,
              emailStudents: update ? false : emailStudents,
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>{update ? "Edit update" : "Publish an update"}</DialogTitle>
            <DialogDescription>
              Tell buyers what changed — a new version of the files, added lessons or a fix.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
              <Field
                label="Version"
                htmlFor="update-version"
                optional
                hint={currentVersion ? `Current: ${currentVersion}` : undefined}
              >
                <Input id="update-version" value={version} onChange={(event) => setVersion(event.target.value)} placeholder="1.3.0" />
              </Field>
              <Field label="Headline" htmlFor="update-title" error={errors.title}>
                <Input
                  id="update-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Faster classification and new escalation rules"
                  required
                />
              </Field>
            </div>
            <Field label="What changed" error={errors.body}>
              <RichTextEditor value={body} onChange={setBody} placeholder="List what's new, what was fixed and anything buyers need to do…" minHeight={170} />
            </Field>
            {!update ? (
              <div className="grid gap-2.5 rounded-lg border border-border bg-subtle/60 p-3 sm:p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox checked={notifyStudents} onChange={(event) => setNotifyStudents(event.target.checked)} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">Notify students in the portal</span>
                    <span className="block text-[0.8125rem] text-muted-foreground">
                      {audience === 0
                        ? "Nobody has access to this product yet."
                        : `Adds a notification for ${audience} ${audience === 1 ? "student" : "students"} with access.`}
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox checked={emailStudents} onChange={(event) => setEmailStudents(event.target.checked)} className="mt-0.5" />
                  <span className="text-sm">
                    <span className="font-medium">Also send an email</span>
                    <span className="block text-[0.8125rem] text-muted-foreground">Goes to students who allow announcement emails.</span>
                  </span>
                </label>
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={save.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={save.pending}>
              {update ? "Save update" : "Publish update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UpdatesManager({
  productId,
  updates,
  currentVersion,
  audience,
}: {
  productId: string;
  updates: UpdateRow[];
  currentVersion: string;
  audience: number;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; update: UpdateRow | null }>({ open: false, update: null });
  const [deleting, setDeleting] = useState<UpdateRow | null>(null);
  const remove = useAction(deleteProductUpdate, { success: "Update deleted", onSuccess: () => setDeleting(null) });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">Updates</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            A changelog buyers can read in their library{currentVersion ? ` · current version ${currentVersion}` : ""}.
          </p>
        </div>
        <Button onClick={() => setDialog({ open: true, update: null })}>
          <Plus /> Publish update
        </Button>
      </div>

      {updates.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No updates published"
          description="When you ship a new version or add content, post it here so everyone who owns the product hears about it."
          action={
            <Button onClick={() => setDialog({ open: true, update: null })}>
              <Plus /> Publish the first update
            </Button>
          }
        />
      ) : (
        <ol className="grid gap-3">
          {updates.map((update, index) => (
            <li key={update.id} className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                  <History className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {update.version ? <Badge variant="primary">v{update.version}</Badge> : null}
                    {index === 0 ? (
                      <Badge variant="success" size="sm">
                        Latest
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{update.publishedLabel}</span>
                  </p>
                  <h3 className="mt-1.5 font-display text-base font-semibold tracking-tight">{update.title}</h3>
                  <div className="rich rich-sm mt-2" dangerouslySetInnerHTML={{ __html: update.body }} />
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => setDialog({ open: true, update })}
                    aria-label={`Edit ${update.title}`}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(update)}
                    aria-label={`Delete ${update.title}`}
                    className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <UpdateDialog
        key={`${dialog.update?.id ?? "new"}-${dialog.open}`}
        productId={productId}
        update={dialog.update}
        currentVersion={currentVersion}
        audience={audience}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="It disappears from the changelog in every buyer's library."
        confirmLabel="Delete update"
        loading={remove.pending}
        onConfirm={async () => {
          if (deleting) await remove.run({ productId, updateId: deleting.id });
        }}
      />
    </div>
  );
}
