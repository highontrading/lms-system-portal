"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { changeTeamRole, inviteTeamMember, removeTeamMember } from "@/app/(admin)/admin/team/actions";
import type { Role } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { ROLE_LABELS } from "@/lib/permissions";
import { TEAM_ROLE_DESCRIPTIONS } from "@/components/admin/settings/team-roles";
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
import { Field, Input, Select } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

type StaffRole = Exclude<Role, "STUDENT">;

export function InviteTeamMemberButton({ roles }: { roles: StaffRole[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>(roles[roles.length - 1] ?? "SUPPORT");
  const invite = useAction(inviteTeamMember, {
    toastError: false,
    success: (data) => (data.invited ? "Invitation sent" : "Team member added"),
    onSuccess: () => {
      setOpen(false);
      setName("");
      setEmail("");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) invite.clearErrors();
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <UserPlus />
        Invite team member
      </Button>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            invite.run({ name, email, role });
          }}
        >
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>They get an email with a link to sign in and choose a password.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {invite.error && Object.keys(invite.fieldErrors).length === 0 ? <Callout tone="danger">{invite.error}</Callout> : null}
            <Field label="Name" htmlFor="team-name" error={invite.fieldErrors.name}>
              <Input id="team-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" htmlFor="team-email" error={invite.fieldErrors.email}>
              <Input id="team-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" />
            </Field>
            <Field label="Role" htmlFor="team-role" error={invite.fieldErrors.role} hint={TEAM_ROLE_DESCRIPTIONS[role]}>
              <Select id="team-role" value={role} onChange={(event) => setRole(event.target.value as StaffRole)}>
                {roles.map((option) => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={invite.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={invite.pending}>
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Role dropdown + remove button for one team member. Disabled when the viewer isn't allowed to change them. */
export function TeamMemberControls({
  userId,
  name,
  role,
  roles,
  locked,
}: {
  userId: string;
  name: string;
  role: StaffRole;
  roles: StaffRole[];
  /** Why this row can't be edited, if it can't. */
  locked: string | null;
}) {
  const [confirm, setConfirm] = useState(false);
  const change = useAction(changeTeamRole, { success: "Role updated" });
  const remove = useAction(removeTeamMember, { success: `${name} removed from the team`, onSuccess: () => setConfirm(false) });

  if (locked) return <span className="text-[0.8125rem] text-muted-foreground">{locked}</span>;

  const options = roles.includes(role) ? roles : [role, ...roles];
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="w-36">
        <Select
          aria-label={`Role for ${name}`}
          value={role}
          disabled={change.pending}
          onChange={(event) => change.run({ userId, role: event.target.value as StaffRole })}
          className="h-8.5 text-[0.8125rem]"
        >
          {options.map((option) => (
            <option key={option} value={option} disabled={!roles.includes(option)}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </Select>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        trigger={
          <Button variant="danger-soft" size="xs">
            Remove
          </Button>
        }
        title={`Remove ${name} from the team?`}
        description="They lose access to the admin panel immediately and are signed out. Their account stays as a student account."
        confirmLabel="Remove"
        loading={remove.pending}
        onConfirm={() => void remove.run({ userId })}
      />
    </div>
  );
}
