"use client";

import { useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAnnouncement, saveAnnouncement } from "@/app/(admin)/admin/announcements/actions";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { useAction } from "@/hooks/use-action";
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
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

export type AnnouncementDraft = {
  id?: string;
  title: string;
  body: string;
  audience: "ALL" | "PRODUCT";
  productId: string | null;
  isPinned: boolean;
  published: boolean;
  emailed: boolean;
};

const BLANK: AnnouncementDraft = {
  title: "",
  body: "",
  audience: "ALL",
  productId: null,
  isPinned: false,
  published: false,
  emailed: false,
};

/** Button that opens the announcement editor — for a new announcement or an existing one. */
export function AnnouncementEditorButton({
  announcement,
  products,
}: {
  announcement?: AnnouncementDraft;
  products: { id: string; title: string }[];
}) {
  const isNew = !announcement?.id;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnnouncementDraft>(announcement ?? BLANK);
  const [sendEmail, setSendEmail] = useState(false);
  const alreadyPublished = !!announcement?.published;

  const save = useAction(saveAnnouncement, {
    toastError: false,
    onSuccess: (data) => {
      if (data.publishedNow) {
        toast.success(
          `Published to ${data.notified.toLocaleString("en")} ${data.notified === 1 ? "student" : "students"}` +
            (data.emailing > 0 ? ` · emailing ${data.emailing.toLocaleString("en")}` : ""),
        );
      } else {
        toast.success("Announcement saved");
      }
      setOpen(false);
      if (isNew) {
        setDraft(BLANK);
        setSendEmail(false);
      }
    },
  });

  const set = <K extends keyof AnnouncementDraft>(key: K, value: AnnouncementDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  function submit(published: boolean) {
    save.run({
      id: draft.id,
      title: draft.title,
      body: draft.body,
      audience: draft.audience,
      productId: draft.audience === "PRODUCT" ? draft.productId : null,
      isPinned: draft.isPinned,
      published,
      sendEmail: published && !alreadyPublished && sendEmail,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraft(announcement ?? BLANK);
          save.clearErrors();
        }
      }}
    >
      {isNew ? (
        <Button onClick={() => setOpen(true)}>
          <Plus />
          New announcement
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label={`Edit ${announcement?.title}`}>
          <Pencil />
        </Button>
      )}
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "New announcement" : "Edit announcement"}</DialogTitle>
          <DialogDescription>
            Students see announcements on their dashboard and get a notification when one is published.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {save.error && Object.keys(save.fieldErrors).length === 0 ? <Callout tone="danger">{save.error}</Callout> : null}

          <Field label="Title" htmlFor="announcement-title" error={save.fieldErrors.title}>
            <Input
              id="announcement-title"
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              maxLength={140}
              placeholder="What's new?"
            />
          </Field>

          <Field label="Message" error={save.fieldErrors.body}>
            <RichTextEditor value={draft.body} onChange={(html) => set("body", html)} placeholder="Write your announcement…" minHeight={160} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Who should see it" htmlFor="announcement-audience">
              <Select
                id="announcement-audience"
                value={draft.audience}
                onChange={(event) => set("audience", event.target.value as AnnouncementDraft["audience"])}
              >
                <option value="ALL">Every student</option>
                <option value="PRODUCT">Students of one product</option>
              </Select>
            </Field>
            {draft.audience === "PRODUCT" ? (
              <Field label="Product" htmlFor="announcement-product" error={save.fieldErrors.productId}>
                <Select
                  id="announcement-product"
                  value={draft.productId ?? ""}
                  onChange={(event) => set("productId", event.target.value || null)}
                >
                  <option value="">Choose a product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={draft.isPinned} onChange={(event) => set("isPinned", event.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Pin to the top</span>
              <span className="block text-[0.8125rem] text-muted-foreground">Pinned announcements stay above newer ones.</span>
            </span>
          </label>

          {alreadyPublished ? null : (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-medium">Also email it when published</span>
                <span className="block text-[0.8125rem] text-muted-foreground">
                  Goes to students who haven&apos;t turned off announcement emails. Needs email set up in Settings.
                </span>
              </span>
            </label>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={save.pending}>
            Cancel
          </Button>
          {alreadyPublished ? (
            <>
              <Button variant="secondary" disabled={save.pending} onClick={() => submit(false)}>
                Unpublish
              </Button>
              <Button loading={save.pending} onClick={() => submit(true)}>
                Save changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" disabled={save.pending} onClick={() => submit(false)}>
                Save draft
              </Button>
              <Button loading={save.pending} onClick={() => submit(true)}>
                <Megaphone />
                Publish
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAnnouncementButton({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const remove = useAction(deleteAnnouncement, { success: "Announcement deleted", onSuccess: () => setOpen(false) });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon-sm" className="text-danger-text hover:bg-danger-soft" aria-label={`Delete ${title}`}>
          <Trash2 />
        </Button>
      }
      title="Delete this announcement?"
      description={`“${title}” will be removed for everyone. Notifications already sent stay in students' inboxes.`}
      confirmLabel="Delete"
      loading={remove.pending}
      onConfirm={() => void remove.run({ id })}
    />
  );
}
