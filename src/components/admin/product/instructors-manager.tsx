"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { deleteInstructor, saveInstructor } from "@/app/(admin)/admin/instructors/actions";
import { useAction } from "@/hooks/use-action";
import { ImageField } from "@/components/admin/image-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";

export type InstructorRow = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  youtube: string | null;
  instagram: string | null;
  productCount: number;
};

type Draft = {
  id?: string;
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  website: string;
  twitter: string;
  linkedin: string;
  youtube: string;
  instagram: string;
};

const EMPTY: Draft = { name: "", title: "", bio: "", avatarUrl: "", website: "", twitter: "", linkedin: "", youtube: "", instagram: "" };

const LINKS: { key: "website" | "youtube" | "instagram" | "linkedin" | "twitter"; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://…" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@…" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/…" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/…" },
  { key: "twitter", label: "X / Twitter", placeholder: "https://x.com/…" },
];

export function InstructorsManager({ instructors }: { instructors: InstructorRow[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<InstructorRow | null>(null);

  const save = useAction(saveInstructor, { success: "Instructor saved", onSuccess: () => setDraft(null) });
  const remove = useAction(deleteInstructor, { success: "Instructor removed", onSuccess: () => setDeleting(null) });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDraft(EMPTY)}>
          <Plus /> Add instructor
        </Button>
      </div>

      {instructors.length === 0 ? (
        <EmptyState
          icon={<UserCog />}
          title="No instructors yet"
          description="Add the people who teach your products. Their profile appears on each product page they're attached to."
          action={
            <Button onClick={() => setDraft(EMPTY)}>
              <Plus /> Add instructor
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {instructors.map((instructor) => (
            <Card key={instructor.id} className="flex items-start gap-3.5 p-4">
              <Avatar name={instructor.name} src={instructor.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-semibold tracking-tight">{instructor.name}</p>
                {instructor.title ? <p className="truncate text-[0.8125rem] text-muted-foreground">{instructor.title}</p> : null}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {instructor.productCount} {instructor.productCount === 1 ? "product" : "products"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${instructor.name}`}
                  onClick={() =>
                    setDraft({
                      id: instructor.id,
                      name: instructor.name,
                      title: instructor.title ?? "",
                      bio: instructor.bio ?? "",
                      avatarUrl: instructor.avatarUrl ?? "",
                      website: instructor.website ?? "",
                      twitter: instructor.twitter ?? "",
                      linkedin: instructor.linkedin ?? "",
                      youtube: instructor.youtube ?? "",
                      instagram: instructor.instagram ?? "",
                    })
                  }
                >
                  <Pencil />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${instructor.name}`} onClick={() => setDeleting(instructor)}>
                  <Trash2 />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        {draft ? (
          <DialogContent size="md">
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                save.run(draft);
              }}
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Edit instructor" : "Add instructor"}</DialogTitle>
                <DialogDescription>Shown on the pages of the products they teach.</DialogDescription>
              </DialogHeader>
              <DialogBody className="grid gap-4">
                <ImageField
                  label="Photo"
                  value={draft.avatarUrl}
                  onChange={(url) => setDraft({ ...draft, avatarUrl: url })}
                  purpose="avatar"
                  aspect="square"
                />
                {save.fieldErrors.avatarUrl ? (
                  <p className="-mt-2 text-[0.8125rem] font-medium text-danger-text">{save.fieldErrors.avatarUrl}</p>
                ) : null}
                <Field label="Name" htmlFor="instructor-name" error={save.fieldErrors.name}>
                  <Input
                    id="instructor-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Title" htmlFor="instructor-title" hint="For example “Automation consultant”." optional>
                  <Input
                    id="instructor-title"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                    maxLength={120}
                  />
                </Field>
                <Field label="Bio" htmlFor="instructor-bio" optional>
                  <Textarea
                    id="instructor-bio"
                    rows={4}
                    value={draft.bio}
                    onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
                    maxLength={2000}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  {LINKS.map((linkField) => (
                    <Field
                      key={linkField.key}
                      label={linkField.label}
                      htmlFor={`instructor-${linkField.key}`}
                      error={save.fieldErrors[linkField.key]}
                      optional
                    >
                      <Input
                        id={`instructor-${linkField.key}`}
                        type="url"
                        inputMode="url"
                        value={draft[linkField.key]}
                        onChange={(event) => setDraft({ ...draft, [linkField.key]: event.target.value })}
                        placeholder={linkField.placeholder}
                      />
                    </Field>
                  ))}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={save.pending}>
                  Save instructor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.name ?? ""}?`}
        description={
          deleting && deleting.productCount > 0
            ? `They'll be removed from ${deleting.productCount} ${deleting.productCount === 1 ? "product" : "products"}. The products themselves stay.`
            : "They aren't attached to any products."
        }
        confirmLabel="Remove instructor"
        loading={remove.pending}
        onConfirm={async () => {
          if (deleting) await remove.run({ id: deleting.id });
        }}
      />
    </>
  );
}
