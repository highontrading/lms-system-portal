"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { deletePage, savePage } from "@/app/(admin)/admin/pages/actions";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { useAction } from "@/hooks/use-action";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { Callout } from "@/components/ui/misc";

type PageDraft = {
  id?: string;
  title: string;
  slug: string;
  body: string;
  seoDescription: string;
  isPublished: boolean;
  showInFooter: boolean;
};

const BLANK: PageDraft = { title: "", slug: "", body: "", seoDescription: "", isPublished: true, showInFooter: true };

export function PageEditor({ page }: { page: PageDraft | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PageDraft>(page ?? BLANK);
  // Until the address is edited by hand, a new page's address follows its title.
  const [slugTouched, setSlugTouched] = useState(!!page);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useAction(savePage, {
    toastError: false,
    success: "Page saved",
    onSuccess: (data) => {
      if (data.created) router.replace(`/admin/pages/${data.id}`);
    },
  });
  const remove = useAction(deletePage, { success: "Page deleted" });

  const set = <K extends keyof PageDraft>(key: K, value: PageDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"
      onSubmit={(event) => {
        event.preventDefault();
        save.run({ ...draft, id: page?.id });
      }}
    >
      <Card className="min-w-0">
        <CardContent className="grid gap-5">
          {save.error && Object.keys(save.fieldErrors).length === 0 ? <Callout tone="danger">{save.error}</Callout> : null}
          <Field label="Title" htmlFor="page-title" error={save.fieldErrors.title}>
            <Input
              id="page-title"
              value={draft.title}
              maxLength={120}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({ ...current, title, slug: slugTouched ? current.slug : slugify(title) }));
              }}
              placeholder="About us"
            />
          </Field>
          <Field
            label="Address"
            htmlFor="page-slug"
            error={save.fieldErrors.slug}
            hint="The page will be public at this address. Lowercase letters, numbers and dashes."
          >
            <div className="flex items-center">
              <span className="grid h-10 shrink-0 place-items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                /
              </span>
              <Input
                id="page-slug"
                value={draft.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value.toLowerCase());
                }}
                className="rounded-l-none font-mono"
                spellCheck={false}
                placeholder="about"
                aria-invalid={!!save.fieldErrors.slug}
              />
            </div>
          </Field>
          <Field label="Content" error={save.fieldErrors.body}>
            <RichTextEditor value={draft.body} onChange={(html) => set("body", html)} placeholder="Write the page…" minHeight={320} />
          </Field>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:sticky lg:top-6">
        <Card>
          <CardContent className="grid gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="page-published" className="text-sm">
                  Published
                </Label>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Anyone with the address can read it.</p>
              </div>
              <Switch id="page-published" checked={draft.isPublished} onCheckedChange={(checked) => set("isPublished", checked)} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="page-footer" className="text-sm">
                  Link in the footer
                </Label>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">Adds this page to the site footer.</p>
              </div>
              <Switch id="page-footer" checked={draft.showInFooter} onCheckedChange={(checked) => set("showInFooter", checked)} />
            </div>
            <Field label="Search description" htmlFor="page-seo" optional error={save.fieldErrors.seoDescription} hint="Shown in search results.">
              <Textarea
                id="page-seo"
                rows={3}
                maxLength={200}
                value={draft.seoDescription}
                onChange={(event) => set("seoDescription", event.target.value)}
              />
            </Field>
            <Button type="submit" loading={save.pending}>
              {page ? "Save changes" : "Create page"}
            </Button>
            {page && draft.isPublished ? (
              <Button asChild variant="secondary">
                <Link href={`/${page.slug}`} target="_blank">
                  <ExternalLink />
                  View page
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {page?.id ? (
          <ConfirmDialog
            open={confirmDelete}
            onOpenChange={setConfirmDelete}
            trigger={
              <Button variant="danger-soft">
                <Trash2 />
                Delete page
              </Button>
            }
            title="Delete this page?"
            description={`“${page.title}” will be removed and its address will stop working. This can't be undone.`}
            confirmLabel="Delete page"
            loading={remove.pending}
            onConfirm={() => void remove.run({ id: page.id! })}
          />
        ) : null}
      </div>
    </form>
  );
}
