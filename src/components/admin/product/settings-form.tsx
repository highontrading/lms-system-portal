"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import type { ProductStatus, ProductVisibility } from "@/generated/prisma/enums";
import { deleteProduct, setProductStatus, updateProductSettings } from "@/app/(admin)/admin/products/actions";
import { useAction } from "@/hooks/use-action";
import { VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { SaveBar } from "@/components/admin/product/save-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";

export type SettingsValues = {
  visibility: ProductVisibility;
  featured: boolean;
  position: string;
  seoTitle: string;
  seoDescription: string;
};

type Props = {
  productId: string;
  title: string;
  status: ProductStatus;
  enrollmentCount: number;
  initial: SettingsValues;
};

const VISIBILITIES: ProductVisibility[] = ["PUBLIC", "UNLISTED", "PRIVATE"];

export function SettingsForm({ productId, title, status, enrollmentCount, initial }: Props) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  const save = useAction(updateProductSettings, { success: "Settings saved" });
  const changeStatus = useAction(setProductStatus, {
    success: (data) => (data.status === "ARCHIVED" ? "Archived" : "Restored to draft"),
  });
  const remove = useAction(deleteProduct, { onError: () => setConfirmDelete(false) });

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const submitted = values;
        const result = await save.run({
          id: productId,
          visibility: values.visibility,
          featured: values.featured,
          position: Number(values.position) || 0,
          seoTitle: values.seoTitle.trim(),
          seoDescription: values.seoDescription.trim(),
        });
        if (result.ok) setSaved(submitted);
      }}
    >
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
            <CardDescription>Who can find this product once it is published. Students who have access always see it in their library.</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="Visibility" className="grid gap-2.5">
              {VISIBILITIES.map((option) => {
                const selected = values.visibility === option;
                return (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                      selected ? "border-primary bg-primary-soft/50" : "border-border hover:border-border-strong",
                    )}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option}
                      checked={selected}
                      onChange={() => set("visibility", option)}
                      className="mt-0.5 size-4 accent-[var(--brand)]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{VISIBILITY_LABELS[option]}</span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">
                        {VISIBILITY_DESCRIPTIONS[option]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Placement</CardTitle>
            <CardDescription>How this product is ordered and highlighted in the catalog.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex items-start justify-between gap-4">
              <label htmlFor="featured" className="min-w-0 cursor-pointer">
                <span className="block text-sm font-medium">Feature on the home page</span>
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">
                  Shown in the highlighted section at the top of the site.
                </span>
              </label>
              <Switch id="featured" checked={values.featured} onCheckedChange={(checked) => set("featured", checked)} />
            </div>
            <Field label="Sort order" htmlFor="position" hint="Lower numbers come first. Products with the same number are sorted by newest.">
              <Input
                id="position"
                inputMode="numeric"
                value={values.position}
                onChange={(event) => set("position", event.target.value.replace(/\D/g, ""))}
                className="max-w-28"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Search engines and sharing</CardTitle>
            <CardDescription>Optional. Left empty, the title and tagline are used.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Page title" htmlFor="seoTitle" error={save.fieldErrors.seoTitle} hint={`${values.seoTitle.length}/70`} optional>
              <Input id="seoTitle" value={values.seoTitle} maxLength={70} onChange={(event) => set("seoTitle", event.target.value)} />
            </Field>
            <Field
              label="Description"
              htmlFor="seoDescription"
              error={save.fieldErrors.seoDescription}
              hint={`${values.seoDescription.length}/200`}
              optional
            >
              <Textarea
                id="seoDescription"
                rows={3}
                value={values.seoDescription}
                maxLength={200}
                onChange={(event) => set("seoDescription", event.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">{status === "ARCHIVED" ? "Restore this product" : "Archive this product"}</p>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {status === "ARCHIVED"
                    ? "Brings it back as a draft so you can publish it again."
                    : "Removes it from the catalog. Students who already have access keep it."}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={changeStatus.pending}
                onClick={() => changeStatus.run({ id: productId, status: status === "ARCHIVED" ? "DRAFT" : "ARCHIVED" })}
                className="shrink-0"
              >
                {status === "ARCHIVED" ? (
                  <>
                    <ArchiveRestore /> Restore
                  </>
                ) : (
                  <>
                    <Archive /> Archive
                  </>
                )}
              </Button>
            </div>
            <div className="h-px bg-border" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Delete this product</p>
                <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                  {enrollmentCount > 0
                    ? `Not possible: ${enrollmentCount.toLocaleString("en")} ${enrollmentCount === 1 ? "student has" : "students have"} been given it. Archive it instead.`
                    : "Permanently removes it with all lessons, sessions and files."}
                </p>
              </div>
              <Button
                type="button"
                variant="danger-soft"
                size="sm"
                disabled={enrollmentCount > 0}
                onClick={() => setConfirmDelete(true)}
                className="shrink-0"
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${title}”?`}
        description="This permanently removes the product and all of its lessons, sessions and files. This can't be undone."
        confirmLabel="Delete product"
        loading={remove.pending}
        onConfirm={async () => {
          await remove.run({ id: productId });
        }}
      />

      <SaveBar dirty={dirty} pending={save.pending} onReset={() => setValues(saved)} />
    </form>
  );
}
