"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { removeSampleContent } from "@/components/admin/people/demo-actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Callout } from "@/components/ui/misc";

/** Reminder that the install still contains the sample catalogue, with a one-click clean-up. */
export function DemoBanner({ canRemove }: { canRemove: boolean }) {
  const [open, setOpen] = useState(false);
  const remove = useAction(removeSampleContent, {
    success: (data) =>
      `Removed ${data.products} sample product${data.products === 1 ? "" : "s"} and ${data.students} sample student${data.students === 1 ? "" : "s"}`,
    onSuccess: () => setOpen(false),
  });

  return (
    <>
      <Callout
        tone="warning"
        icon={<FlaskConical />}
        title="Sample content is installed"
        className="mb-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            The sample products and sample students (@example.com) are here so you can explore. Remove them before
            you invite real students.
          </p>
          {canRemove ? (
            <Button variant="secondary" size="sm" className="shrink-0 self-start sm:self-center" onClick={() => setOpen(true)}>
              Remove sample content
            </Button>
          ) : null}
        </div>
      </Callout>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Remove all sample content?"
        description="This deletes the sample products, their lessons and files, and the sample students with their progress. Your own products, students, pages and settings are not touched. This can't be undone."
        confirmLabel="Remove sample content"
        loading={remove.pending}
        onConfirm={() => void remove.run({})}
      />
    </>
  );
}
