"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ExternalLink, MoreHorizontal, Trash2 } from "lucide-react";
import type { ProductStatus, ProductVisibility } from "@/generated/prisma/enums";
import { deleteProduct, setProductStatus } from "@/app/(admin)/admin/products/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  product: {
    id: string;
    title: string;
    slug: string;
    status: ProductStatus;
    visibility: ProductVisibility;
    enrollmentCount: number;
    freeToJoin: boolean;
  };
};

export function EditorActions({ product }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmFree, setConfirmFree] = useState(false);
  const status = useAction(setProductStatus, {
    success: (data) =>
      data.status === "PUBLISHED" ? "Published — students can see it now" : data.status === "ARCHIVED" ? "Archived" : "Moved back to draft",
  });
  const remove = useAction(deleteProduct, { onError: () => setConfirmDelete(false) });

  const isPublished = product.status === "PUBLISHED";
  const canView = isPublished && product.visibility !== "PRIVATE";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {canView ? (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/catalog/${product.slug}`} target="_blank">
            View page <ExternalLink />
          </Link>
        </Button>
      ) : null}

      {isPublished ? (
        <Button variant="secondary" size="sm" loading={status.pending} onClick={() => status.run({ id: product.id, status: "DRAFT" })}>
          Unpublish
        </Button>
      ) : (
        <Button
          size="sm"
          loading={status.pending}
          onClick={() => (product.freeToJoin ? setConfirmFree(true) : status.run({ id: product.id, status: "PUBLISHED" }))}
        >
          Publish
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {product.status === "ARCHIVED" ? (
            <DropdownMenuItem onSelect={() => status.run({ id: product.id, status: "DRAFT" })}>
              <ArchiveRestore /> Restore to draft
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => status.run({ id: product.id, status: "ARCHIVED" })}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmFree}
        onOpenChange={setConfirmFree}
        title="Publish as free to join?"
        description="This product has no price, so any signed-in visitor will be able to add it to their library themselves. If people pay for it elsewhere, cancel and enter the price under Access — or make it private under Settings."
        confirmLabel="Publish as free"
        variant="primary"
        loading={status.pending}
        onConfirm={async () => {
          await status.run({ id: product.id, status: "PUBLISHED" });
          setConfirmFree(false);
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${product.title}”?`}
        description={
          product.enrollmentCount > 0
            ? "Students already have access to this product, so it can't be deleted. Archive it instead: it leaves the catalog and students keep what they have."
            : "This permanently removes the product and all of its lessons, sessions and files. This can't be undone."
        }
        confirmLabel={product.enrollmentCount > 0 ? "Archive instead" : "Delete product"}
        variant={product.enrollmentCount > 0 ? "primary" : "danger"}
        loading={remove.pending || status.pending}
        onConfirm={async () => {
          if (product.enrollmentCount > 0) {
            await status.run({ id: product.id, status: "ARCHIVED" });
            setConfirmDelete(false);
          } else {
            await remove.run({ id: product.id });
          }
        }}
      />
    </div>
  );
}
