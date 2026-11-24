"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, UserPlus } from "lucide-react";
import { addStudent, grantStudentAccess } from "@/app/(admin)/admin/students/actions";
import { grantAccessByEmail } from "@/app/(admin)/admin/enrollments/actions";
import { useAction } from "@/hooks/use-action";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import type { ProductType } from "@/generated/prisma/enums";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";

export type ProductChoice = { id: string; title: string; type: string; slug: string; sku: string | null };

function typeLabel(type: string) {
  return PRODUCT_TYPE_LABELS[type as ProductType] ?? type;
}

/** Product default · lifetime · or a specific end date. Value is "", "lifetime" or "YYYY-MM-DD". */
export function ExpiryPicker({
  value,
  onChange,
  allowDefault = true,
  id = "expiry",
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  allowDefault?: boolean;
  id?: string;
  error?: string;
}) {
  const mode = value === "" ? "default" : value === "lifetime" ? "lifetime" : "date";
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Field
      label="Access period"
      htmlFor={id}
      error={error}
      hint={mode === "default" ? "Uses the access period set on the product (lifetime unless you changed it)." : undefined}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          id={id}
          value={mode}
          onChange={(event) => {
            const next = event.target.value;
            onChange(next === "default" ? "" : next === "lifetime" ? "lifetime" : today);
          }}
        >
          {allowDefault ? <option value="default">Product default</option> : null}
          <option value="lifetime">Lifetime access</option>
          <option value="date">Until a date…</option>
        </Select>
        {mode === "date" ? (
          <Input
            type="date"
            aria-label="Access ends on"
            value={value}
            min={today}
            onChange={(event) => onChange(event.target.value || today)}
          />
        ) : null}
      </div>
    </Field>
  );
}

function ProductSelect({
  products,
  value,
  onChange,
  error,
  id = "product",
}: {
  products: ProductChoice[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  id?: string;
}) {
  return (
    <Field label="Product" htmlFor={id} error={error}>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error}>
        <option value="">Choose a product…</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.title} — {typeLabel(product.type)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function SendEmailToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      <span>
        <span className="font-medium">Email them their access</span>
        <span className="block text-[0.8125rem] text-muted-foreground">
          New accounts get a one-click link to sign in and set a password.
        </span>
      </span>
    </label>
  );
}

// ───────────────────────────── Grant to a known student ─────────────────────────────

export function GrantAccessDialog({
  userId,
  studentName,
  products,
  ownedProductIds = [],
  buttonProps,
}: {
  userId: string;
  studentName: string;
  products: ProductChoice[];
  ownedProductIds?: string[];
  buttonProps?: ButtonProps;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const grant = useAction(grantStudentAccess, {
    success: (data) => (data.outcome === "unchanged" ? "They already have access to that product" : "Access granted"),
    onSuccess: () => {
      setOpen(false);
      setProductId("");
      setExpiry("");
    },
  });
  const available = products.filter((product) => !ownedProductIds.includes(product.id));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" {...buttonProps}>
          <KeyRound /> Grant access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            grant.run({ userId, productId, expiry, sendEmail });
          }}
        >
          <DialogHeader>
            <DialogTitle>Grant access</DialogTitle>
            <DialogDescription>Add a product to {studentName}&apos;s library.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <ProductSelect
              products={available.length > 0 ? available : products}
              value={productId}
              onChange={setProductId}
              error={grant.fieldErrors.productId}
            />
            <ExpiryPicker value={expiry} onChange={setExpiry} error={grant.fieldErrors.expiry} />
            <SendEmailToggle checked={sendEmail} onChange={setSendEmail} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={grant.pending} disabled={!productId}>
              Grant access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Grant by email (creates the account if needed) ─────────────────────────────

export function GrantByEmailDialog({ products }: { products: ProductChoice[] }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [expiry, setExpiry] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const grant = useAction(grantAccessByEmail, {
    success: (data) =>
      data.outcome === "unchanged"
        ? "They already have access to that product"
        : data.created
          ? "Account created and access granted"
          : "Access granted",
    onSuccess: () => {
      setOpen(false);
      setEmail("");
      setName("");
      setProductId("");
      setExpiry("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <KeyRound /> Grant access
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            grant.run({ email, name: name || undefined, productId, expiry, sendEmail });
          }}
        >
          <DialogHeader>
            <DialogTitle>Grant access</DialogTitle>
            <DialogDescription>
              Enter the buyer&apos;s email. If they don&apos;t have an account yet, one is created for them.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <Field label="Email" htmlFor="grant-email" error={grant.fieldErrors.email}>
              <Input
                id="grant-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="buyer@example.com"
                required
                aria-invalid={!!grant.fieldErrors.email}
              />
            </Field>
            <Field label="Name" htmlFor="grant-name" optional hint="Only used when a new account is created.">
              <Input id="grant-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <ProductSelect
              id="grant-product"
              products={products}
              value={productId}
              onChange={setProductId}
              error={grant.fieldErrors.productId}
            />
            <ExpiryPicker id="grant-expiry" value={expiry} onChange={setExpiry} error={grant.fieldErrors.expiry} />
            <SendEmailToggle checked={sendEmail} onChange={setSendEmail} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={grant.pending} disabled={!productId || !email}>
              Grant access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Add a student ─────────────────────────────

export function AddStudentDialog({ products }: { products: ProductChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const add = useAction(addStudent, {
    success: (data) => (data.created ? "Student added" : "Access granted to the existing student"),
    onSuccess: (data) => {
      setOpen(false);
      setName("");
      setEmail("");
      setProductIds([]);
      router.push(`/admin/students/${data.id}`);
    },
  });

  function toggle(id: string) {
    setProductIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Add student
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault();
            add.run({ name: name || undefined, email, productIds, sendEmail });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a student</DialogTitle>
            <DialogDescription>Create an account and choose what they can access.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <Field label="Email" htmlFor="student-email" error={add.fieldErrors.email}>
              <Input
                id="student-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="student@example.com"
                required
                aria-invalid={!!add.fieldErrors.email}
              />
            </Field>
            <Field label="Name" htmlFor="student-name" optional error={add.fieldErrors.name}>
              <Input id="student-name" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            {products.length > 0 ? (
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-[0.8125rem] font-medium">Give access to</legend>
                <div className="grid max-h-52 gap-0.5 overflow-y-auto rounded-md border border-border p-1.5">
                  {products.map((product) => (
                    <label
                      key={product.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox checked={productIds.includes(product.id)} onChange={() => toggle(product.id)} />
                      <span className="min-w-0 flex-1 truncate">{product.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{typeLabel(product.type)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <SendEmailToggle checked={sendEmail} onChange={setSendEmail} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={add.pending} disabled={!email}>
              Add student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
