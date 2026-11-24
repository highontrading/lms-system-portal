"use client";

import { useState } from "react";
import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { createApiKey, revokeApiKey } from "@/app/(admin)/admin/integrations/actions";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/controls";
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
import { Field, Input } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

/** "Create key" button + dialog. The full key is displayed once, then only its prefix is ever shown. */
export function CreateApiKeyButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const create = useAction(createApiKey, {
    toastError: false,
    onSuccess: (data) => setCreated({ name: data.name, key: data.key }),
  });

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setName("");
      setCreated(null);
      create.clearErrors();
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        Create key
      </Button>
      <DialogContent size="md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>
                This is the only time “{created.name}” is shown in full. Store it somewhere safe, like your automation
                tool&apos;s credentials.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div className="rounded-lg border border-border bg-subtle p-3">
                <code className="block font-mono text-[0.8125rem] leading-relaxed break-all select-all">{created.key}</code>
              </div>
              <CopyButton value={created.key} label="Copy key" toastMessage="API key copied" size="md" variant="primary" className="w-full" />
              <Callout tone="warning" icon={<TriangleAlert />}>
                Anyone with this key can grant or remove access. If it leaks, revoke it and create a new one.
              </Callout>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => reset(false)}>
                I&apos;ve saved it
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault();
              create.run({ name });
            }}
          >
            <DialogHeader>
              <DialogTitle>Create an API key</DialogTitle>
              <DialogDescription>One key per platform or automation makes it easy to revoke just that one later.</DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              {create.error && !create.fieldErrors.name ? <Callout tone="danger">{create.error}</Callout> : null}
              <Field label="Name" htmlFor="api-key-name" error={create.fieldErrors.name} hint="For example “Main website checkout” or “n8n automation”.">
                <Input id="api-key-name" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={60} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => reset(false)} disabled={create.pending}>
                Cancel
              </Button>
              <Button type="submit" loading={create.pending}>
                <KeyRound />
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RevokeApiKeyButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const revoke = useAction(revokeApiKey, { success: "Key revoked", onSuccess: () => setOpen(false) });
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="danger-soft" size="xs">
          Revoke
        </Button>
      }
      title={`Revoke “${name}”?`}
      description="Anything still using this key will immediately stop being able to grant or remove access. This can't be undone."
      confirmLabel="Revoke key"
      loading={revoke.pending}
      onConfirm={() => void revoke.run({ id })}
    />
  );
}

/** A code sample with a copy button that scrolls sideways instead of stretching the page. */
export function CodeSample({ title, code }: { title: string; code: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-[oklch(0.2_0.025_284)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3.5 py-2">
        <span className="truncate text-xs font-medium text-white/70">{title}</span>
        <CopyButton value={code} size="xs" variant="ghost" className="shrink-0 text-white/80 hover:bg-white/10 hover:text-white" />
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-[0.8125rem] leading-relaxed text-[oklch(0.94_0.01_285)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
