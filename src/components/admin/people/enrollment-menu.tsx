"use client";

import { useState } from "react";
import { CalendarClock, CircleCheck, Ellipsis, Mail, RotateCcw, ShieldOff, Undo2 } from "lucide-react";
import {
  changeEnrollmentExpiry,
  completeEnrollment,
  resendAccessEmail,
  resetEnrollmentProgress,
  restoreEnrollment,
  revokeEnrollment,
} from "@/app/(admin)/admin/students/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpiryPicker } from "@/components/admin/people/access-forms";

export type EnrollmentMenuTarget = {
  id: string;
  status: "active" | "expired" | "revoked";
  /** "lifetime" or "YYYY-MM-DD" */
  expiry: string;
  productTitle: string;
  studentName: string;
  hasLessons: boolean;
};

/** Per-row actions for one student's access to one product. */
export function EnrollmentMenu({ enrollment }: { enrollment: EnrollmentMenuTarget }) {
  const [dialog, setDialog] = useState<"revoke" | "reset" | "expiry" | null>(null);
  const [expiry, setExpiry] = useState(enrollment.expiry);

  const close = () => setDialog(null);
  const revoke = useAction(revokeEnrollment, { success: "Access revoked", onSuccess: close });
  const restore = useAction(restoreEnrollment, { success: "Access restored" });
  const reset = useAction(resetEnrollmentProgress, { success: "Progress reset", onSuccess: close });
  const complete = useAction(completeEnrollment, { success: "Marked as complete" });
  const resend = useAction(resendAccessEmail, { success: "Access email sent" });
  const saveExpiry = useAction(changeEnrollmentExpiry, { success: "Access period updated", onSuccess: close });

  const revoked = enrollment.status === "revoked";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${enrollment.productTitle}`}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {revoked ? (
            <DropdownMenuItem onSelect={() => restore.run({ id: enrollment.id })}>
              <Undo2 /> Restore access
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem
                onSelect={() => {
                  setExpiry(enrollment.expiry);
                  setDialog("expiry");
                }}
              >
                <CalendarClock /> Change access period
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => resend.run({ id: enrollment.id })}>
                <Mail /> Resend access email
              </DropdownMenuItem>
              {enrollment.hasLessons ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => complete.run({ id: enrollment.id })}>
                    <CircleCheck /> Mark as complete
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setDialog("reset")}>
                    <RotateCcw /> Reset progress
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setDialog("revoke")}>
                <ShieldOff /> Revoke access
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={dialog === "revoke"}
        onOpenChange={(open) => !open && close()}
        title={`Revoke ${enrollment.productTitle}?`}
        description={`${enrollment.studentName} will lose access immediately. Their progress is kept, and you can restore access later.`}
        confirmLabel="Revoke access"
        loading={revoke.pending}
        onConfirm={() => void revoke.run({ id: enrollment.id })}
      />

      <ConfirmDialog
        open={dialog === "reset"}
        onOpenChange={(open) => !open && close()}
        title="Reset progress?"
        description={`This clears ${enrollment.studentName}'s completed lessons and quiz attempts for ${enrollment.productTitle}. A certificate they already earned is kept.`}
        confirmLabel="Reset progress"
        loading={reset.pending}
        onConfirm={() => void reset.run({ id: enrollment.id })}
      />

      <Dialog open={dialog === "expiry"} onOpenChange={(open) => !open && close()}>
        <DialogContent size="sm">
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              saveExpiry.run({ id: enrollment.id, expiry });
            }}
          >
            <DialogHeader>
              <DialogTitle>Change access period</DialogTitle>
              <DialogDescription>
                {enrollment.productTitle} · {enrollment.studentName}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ExpiryPicker
                id={`expiry-${enrollment.id}`}
                value={expiry}
                onChange={setExpiry}
                allowDefault={false}
                error={saveExpiry.fieldErrors.expiry}
              />
              {enrollment.status === "expired" ? (
                <p className="mt-3 text-[0.8125rem] text-muted-foreground">
                  This access has ended. Choosing lifetime or a future date restores it.
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" loading={saveExpiry.pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
