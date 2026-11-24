"use client";

import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { deleteCategory, saveCategory } from "@/app/(admin)/admin/categories/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { Table, TableCard, TBody, Td, Th, THead, Tr } from "@/components/ui/table";

export type CategoryRow = { id: string; name: string; slug: string; description: string | null; position: number; productCount: number };

type Draft = { id?: string; name: string; description: string; position: string };

const EMPTY: Draft = { name: "", description: "", position: "0" };

export function CategoriesManager({ categories }: { categories: CategoryRow[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const save = useAction(saveCategory, { success: "Category saved", onSuccess: () => setDraft(null) });
  const remove = useAction(deleteCategory, { success: "Category deleted", onSuccess: () => setDeleting(null) });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDraft(EMPTY)}>
          <Plus /> New category
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={<Tags />}
          title="No categories yet"
          description="Categories group products in the catalog, for example “AI & Automation” or “No-code tools”."
          action={
            <Button onClick={() => setDraft(EMPTY)}>
              <Plus /> New category
            </Button>
          }
        />
      ) : (
        <TableCard>
          <Table>
            <THead>
              <tr>
                <Th>Category</Th>
                <Th className="hidden sm:table-cell">Description</Th>
                <Th className="text-right">Products</Th>
                <Th className="w-0">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {categories.map((category) => (
                <Tr key={category.id}>
                  <Td>
                    <span className="block font-medium">{category.name}</span>
                    <span className="block text-xs text-muted-foreground">/{category.slug}</span>
                  </Td>
                  <Td className="hidden max-w-sm text-muted-foreground sm:table-cell">
                    <span className="line-clamp-2 whitespace-normal">{category.description || "—"}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{category.productCount}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${category.name}`}
                        onClick={() =>
                          setDraft({
                            id: category.id,
                            name: category.name,
                            description: category.description ?? "",
                            position: String(category.position),
                          })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableCard>
      )}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        {draft ? (
          <DialogContent size="sm">
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                save.run({ id: draft.id, name: draft.name, description: draft.description, position: Number(draft.position) || 0 });
              }}
            >
              <DialogHeader>
                <DialogTitle>{draft.id ? "Edit category" : "New category"}</DialogTitle>
                <DialogDescription>Shown as a filter in the catalog.</DialogDescription>
              </DialogHeader>
              <DialogBody className="grid gap-4">
                <Field label="Name" htmlFor="category-name" error={save.fieldErrors.name}>
                  <Input
                    id="category-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    autoFocus
                    required
                  />
                </Field>
                <Field label="Description" htmlFor="category-description" error={save.fieldErrors.description} optional>
                  <Textarea
                    id="category-description"
                    rows={3}
                    value={draft.description}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    maxLength={300}
                  />
                </Field>
                <Field label="Sort order" htmlFor="category-position" hint="Lower numbers come first.">
                  <Input
                    id="category-position"
                    inputMode="numeric"
                    value={draft.position}
                    onChange={(event) => setDraft({ ...draft, position: event.target.value.replace(/\D/g, "") })}
                    className="max-w-24"
                  />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={save.pending}>
                  Save category
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete “${deleting?.name ?? ""}”?`}
        description={
          deleting && deleting.productCount > 0
            ? `${deleting.productCount} ${deleting.productCount === 1 ? "product" : "products"} will become uncategorised. The products themselves are not deleted.`
            : "No products use this category."
        }
        confirmLabel="Delete category"
        loading={remove.pending}
        onConfirm={async () => {
          if (deleting) await remove.run({ id: deleting.id });
        }}
      />
    </>
  );
}
