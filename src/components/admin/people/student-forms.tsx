"use client";

import { useState } from "react";
import { Eye, KeyRound, UserCheck, UserX } from "lucide-react";
import {
  sendStudentPasswordReset,
  setStudentStatus,
  updateStudent,
  viewAsStudent,
} from "@/app/(admin)/admin/students/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";

export function StudentProfileForm({
  student,
  canManage,
}: {
  student: { id: string; name: string; email: string; phone: string | null; adminNote: string | null };
  canManage: boolean;
}) {
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone ?? "");
  const [adminNote, setAdminNote] = useState(student.adminNote ?? "");
  const save = useAction(updateStudent, { success: "Profile saved" });

  const dirty =
    name !== student.name ||
    email !== student.email ||
    phone !== (student.phone ?? "") ||
    adminNote !== (student.adminNote ?? "");

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.run({ id: student.id, name, email, phone, adminNote });
      }}
    >
      <Field label="Name" htmlFor="profile-name" error={save.fieldErrors.name}>
        <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} required />
      </Field>
      <Field
        label="Email"
        htmlFor="profile-email"
        error={save.fieldErrors.email}
        hint="This is the address they sign in with. Change it if they bought with a different email."
      >
        <Input
          id="profile-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={!canManage}
          required
        />
      </Field>
      <Field label="Phone" htmlFor="profile-phone" optional error={save.fieldErrors.phone}>
        <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!canManage} />
      </Field>
      <Field
        label="Private note"
        htmlFor="profile-note"
        optional
        hint="Only your team can see this."
        error={save.fieldErrors.adminNote}
      >
        <Textarea
          id="profile-note"
          rows={3}
          value={adminNote}
          onChange={(event) => setAdminNote(event.target.value)}
          disabled={!canManage}
        />
      </Field>
      {canManage ? (
        <div>
          <Button type="submit" loading={save.pending} disabled={!dirty}>
            Save profile
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function StudentAccountActions({
  student,
}: {
  student: { id: string; name: string; status: "ACTIVE" | "SUSPENDED"; isStudent: boolean };
}) {
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const status = useAction(setStudentStatus, {
    success: student.status === "ACTIVE" ? "Account suspended" : "Account reactivated",
    onSuccess: () => setConfirmSuspend(false),
  });
  const reset = useAction(sendStudentPasswordReset, { success: "Password reset link sent" });
  const impersonate = useAction(viewAsStudent);

  return (
    <div className="grid gap-2">
      {student.isStudent ? (
        <Button
          variant="secondary"
          className="justify-start"
          loading={impersonate.pending}
          disabled={student.status !== "ACTIVE"}
          onClick={() => impersonate.run({ id: student.id })}
        >
          <Eye /> View portal as this student
        </Button>
      ) : null}
      <Button
        variant="secondary"
        className="justify-start"
        loading={reset.pending}
        disabled={student.status !== "ACTIVE"}
        onClick={() => reset.run({ id: student.id })}
      >
        <KeyRound /> Send password reset email
      </Button>
      {student.isStudent ? (
        student.status === "ACTIVE" ? (
          <Button variant="danger-soft" className="justify-start" onClick={() => setConfirmSuspend(true)}>
            <UserX /> Suspend account
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="justify-start"
            loading={status.pending}
            onClick={() => status.run({ id: student.id, status: "ACTIVE" })}
          >
            <UserCheck /> Reactivate account
          </Button>
        )
      ) : null}

      <ConfirmDialog
        open={confirmSuspend}
        onOpenChange={setConfirmSuspend}
        title={`Suspend ${student.name}?`}
        description="They are signed out everywhere and can't sign in until you reactivate the account. Their access and progress are kept."
        confirmLabel="Suspend account"
        loading={status.pending}
        onConfirm={() => void status.run({ id: student.id, status: "SUSPENDED" })}
      />
    </div>
  );
}
