"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { saveSettingsSection, sendTestEmail } from "@/app/(admin)/admin/settings/actions";
import { useAction } from "@/hooks/use-action";
import { readableOn } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadButton } from "@/components/ui/controls";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { Callout } from "@/components/ui/misc";
import type { Condition, FieldSpec, SectionSpec } from "@/components/admin/settings/sections";

type Values = Record<string, unknown>;

function getPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object") return (current as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function setPath(source: Values, path: string, value: unknown): Values {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...source, [head]: value };
  const child = source[head] && typeof source[head] === "object" ? (source[head] as Values) : {};
  return { ...source, [head]: setPath(child, rest.join("."), value) };
}

function matches(values: Values, condition: Condition | undefined) {
  return !condition || getPath(values, condition.key) === condition.equals;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Renders one settings section from its declarative spec and saves it through a single action.
 * Used for every settings screen, so they all behave the same way.
 */
export function SettingsForm({
  spec,
  initialValues,
  configuredSecrets,
  adminEmail,
  notice,
}: {
  spec: SectionSpec;
  initialValues: Values;
  configuredSecrets: Record<string, boolean>;
  adminEmail: string;
  notice?: string | null;
}) {
  const [values, setValues] = useState<Values>(initialValues);
  const [baseline, setBaseline] = useState<Values>(initialValues);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(baseline), [values, baseline]);

  const save = useAction(saveSettingsSection, {
    success: `${spec.label} settings saved`,
    onSuccess: () => {
      // Secrets are write-only: clear what was typed so it isn't sent again.
      let next = values;
      for (const key of Object.keys(configuredSecrets)) next = setPath(next, key, "");
      setValues(next);
      setBaseline(next);
    },
  });

  const update = (path: string, value: unknown) => setValues((current) => setPath(current, path, value));

  return (
    <form
      className="grid gap-5 pb-24"
      onSubmit={(event) => {
        event.preventDefault();
        save.run({ section: spec.id as Parameters<typeof saveSettingsSection>[0]["section"], values });
      }}
    >
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">{spec.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{spec.description}</p>
      </div>

      {notice ? <Callout tone="warning">{notice}</Callout> : null}

      {spec.groups
        .filter((group) => matches(values, group.showWhen))
        .map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              {group.description ? <CardDescription>{group.description}</CardDescription> : null}
            </CardHeader>
            <CardContent>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                {group.fields
                  .filter((field) => matches(values, field.showWhen))
                  .map((field) => (
                    <div key={field.key} className={cn("min-w-0", field.half ? "sm:col-span-1" : "sm:col-span-2")}>
                      <FieldControl
                        field={field}
                        id={`${spec.id}-${field.key}`}
                        value={getPath(values, field.key)}
                        onChange={(value) => update(field.key, value)}
                        error={save.fieldErrors[field.key]}
                        errors={save.fieldErrors}
                        errorPrefix={field.key}
                        secretConfigured={configuredSecrets[field.key]}
                      />
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        ))}

      {spec.id === "branding" ? <BrandPreview values={values} /> : null}
      {spec.id === "email" ? <TestEmailCard adminEmail={adminEmail} dirty={dirty} /> : null}

      {/* Sticky save bar: always reachable, also on phones */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pb-safe lg:pl-64">
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-popover px-4 py-3 shadow-lg transition-all duration-200",
            dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
          )}
          aria-hidden={!dirty}
        >
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {save.error && Object.keys(save.fieldErrors).length > 0 ? (
              <span className="font-medium text-danger-text">Some fields need attention.</span>
            ) : (
              "Unsaved changes."
            )}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={save.pending}
              tabIndex={dirty ? 0 : -1}
              onClick={() => {
                setValues(baseline);
                save.clearErrors();
              }}
            >
              Discard
            </Button>
            <Button type="submit" size="sm" loading={save.pending} tabIndex={dirty ? 0 : -1}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ───────────────────────────── Field controls ─────────────────────────────

type ControlProps = {
  field: FieldSpec;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  /** All field errors, so repeaters can show errors on their items. */
  errors: Record<string, string>;
  errorPrefix: string;
  secretConfigured?: boolean;
};

function FieldControl({ field, id, value, onChange, error, errors, errorPrefix, secretConfigured }: ControlProps) {
  const text = typeof value === "string" ? value : value == null ? "" : String(value);

  switch (field.type) {
    case "switch":
      return (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Label htmlFor={id} className="text-sm">
              {field.label}
            </Label>
            {field.hint ? <p className="mt-0.5 text-[0.8125rem] leading-snug text-muted-foreground">{field.hint}</p> : null}
            {error ? <p className="mt-0.5 text-[0.8125rem] font-medium text-danger-text">{error}</p> : null}
          </div>
          <Switch id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked)} />
        </div>
      );

    case "textarea":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint} error={error}>
          <Textarea
            id={id}
            rows={field.rows ?? 3}
            value={text}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={!!error}
          />
        </Field>
      );

    case "select":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint} error={error}>
          <Select id={id} value={text} onChange={(event) => onChange(event.target.value)} aria-invalid={!!error}>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      );

    case "color":
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint} error={error}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${field.label} picker`}
              value={HEX.test(text) ? text : "#000000"}
              onChange={(event) => onChange(event.target.value.toUpperCase())}
              className="size-10 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1 shadow-xs [&::-moz-color-swatch]:rounded [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
            <Input
              id={id}
              value={text}
              onChange={(event) => onChange(event.target.value.trim())}
              placeholder="#5B4BF5"
              maxLength={7}
              spellCheck={false}
              className="font-mono uppercase"
              aria-invalid={!!error}
            />
          </div>
        </Field>
      );

    case "image":
      return <ImageControl field={field} id={id} value={text} onChange={onChange} error={error} />;

    case "secret":
      return (
        <Field
          label={field.label}
          htmlFor={id}
          error={error}
          hint={
            secretConfigured
              ? "Saved — leave blank to keep the current value."
              : (field.hint ?? "Stored encrypted. It is never shown again after saving.")
          }
        >
          <div className="relative">
            <Input
              id={id}
              type="password"
              value={text}
              autoComplete="new-password"
              placeholder={secretConfigured ? "••••••••••••" : field.placeholder}
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={!!error}
              className={secretConfigured ? "pr-20" : undefined}
            />
            {secretConfigured ? (
              <Badge variant="success" size="sm" className="absolute top-1/2 right-2 -translate-y-1/2">
                Saved
              </Badge>
            ) : null}
          </div>
        </Field>
      );

    case "repeater":
      return (
        <RepeaterControl field={field} id={id} value={Array.isArray(value) ? (value as Values[]) : []} onChange={onChange} error={error} errors={errors} errorPrefix={errorPrefix} />
      );

    default:
      return (
        <Field label={field.label} htmlFor={id} hint={field.hint} error={error}>
          <Input
            id={id}
            type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
            inputMode={field.type === "number" ? "numeric" : undefined}
            value={text}
            placeholder={field.placeholder ?? (field.type === "url" ? "https://" : undefined)}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={!!error}
          />
        </Field>
      );
  }
}

function ImageControl({
  field,
  id,
  value,
  onChange,
  error,
}: {
  field: FieldSpec;
  id: string;
  value: string;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const round = field.purpose === "avatar";
  return (
    <Field label={field.label} htmlFor={id} hint={field.hint} error={error}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden border border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:14px_14px]",
            round ? "size-16 rounded-full" : "h-16 w-28 rounded-md",
          )}
        >
          {value ? (
            <img src={value} alt="" className={cn("size-full", round ? "object-cover" : "object-contain p-1.5")} />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <Input
            id={id}
            value={value}
            placeholder="Paste an image address or upload"
            onChange={(event) => onChange(event.target.value.trim())}
            aria-invalid={!!error}
          />
          <div className="flex flex-wrap gap-2">
            <UploadButton
              size="sm"
              purpose={field.purpose ?? "media"}
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              onUploaded={(file) => onChange(file.url)}
            >
              <Upload />
              Upload
            </UploadButton>
            {value ? (
              <Button variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 />
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Field>
  );
}

function RepeaterControl({
  field,
  id,
  value,
  onChange,
  error,
  errors,
  errorPrefix,
}: {
  field: FieldSpec;
  id: string;
  value: Values[];
  onChange: (value: unknown) => void;
  error?: string;
  errors: Record<string, string>;
  errorPrefix: string;
}) {
  const itemFields = field.fields ?? [];
  const atLimit = field.max !== undefined && value.length >= field.max;

  const blank = () => {
    const item: Values = {};
    for (const sub of itemFields) item[sub.key] = sub.type === "select" ? (sub.options?.[0]?.value ?? "") : "";
    return item;
  };
  const move = (from: number, to: number) => {
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-5 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      ) : null}

      {value.map((item, index) => (
        <div key={index} className="rounded-lg border border-border bg-subtle/50 p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {index + 1} of {value.length}
            </span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Move up">
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={index === value.length - 1}
                onClick={() => move(index, index + 1)}
                aria-label="Move down"
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-danger-text hover:bg-danger-soft"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label="Remove"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {itemFields.map((sub) => (
              <div key={sub.key} className={cn("min-w-0", sub.half ? "sm:col-span-1" : "sm:col-span-2")}>
                <FieldControl
                  field={sub}
                  id={`${id}-${index}-${sub.key}`}
                  value={item[sub.key]}
                  onChange={(next) => onChange(value.map((entry, i) => (i === index ? { ...entry, [sub.key]: next } : entry)))}
                  error={errors[`${errorPrefix}.${index}.${sub.key}`]}
                  errors={errors}
                  errorPrefix={`${errorPrefix}.${index}.${sub.key}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {error ? <p className="text-[0.8125rem] font-medium text-danger-text">{error}</p> : null}

      <div>
        <Button variant="secondary" size="sm" disabled={atLimit} onClick={() => onChange([...value, blank()])}>
          <Plus />
          {field.addLabel ?? "Add"}
        </Button>
        {atLimit ? <span className="ml-3 text-xs text-muted-foreground">Limit of {field.max} reached.</span> : null}
      </div>
    </div>
  );
}

// ───────────────────────────── Section extras ─────────────────────────────

/** Shows the colours as they will look on real controls, before saving. */
function BrandPreview({ values }: { values: Values }) {
  const brand = typeof values.brandColor === "string" && HEX.test(values.brandColor) ? values.brandColor : "#5B4BF5";
  const accent = typeof values.accentColor === "string" && HEX.test(values.accentColor) ? values.accentColor : "#FFC93C";
  const radius = values.radius === "sharp" ? "0.375rem" : values.radius === "round" ? "1.125rem" : "0.75rem";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>How buttons, badges and progress will look with these choices.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-5">
          <span
            className="inline-flex h-10 items-center px-4 text-sm font-medium shadow-sm"
            style={{ background: brand, color: readableOn(brand), borderRadius: `calc(${radius} - 2px)` }}
          >
            Continue learning
          </span>
          <span
            className="inline-flex h-10 items-center px-4 text-sm font-medium"
            style={{
              background: `color-mix(in oklab, ${brand} 12%, transparent)`,
              color: `color-mix(in oklab, ${brand} 80%, var(--foreground))`,
              borderRadius: `calc(${radius} - 2px)`,
            }}
          >
            Secondary
          </span>
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: accent, color: readableOn(accent) }}
          >
            New
          </span>
          <span className="text-sm font-medium underline underline-offset-4" style={{ color: `color-mix(in oklab, ${brand} 85%, var(--foreground))` }}>
            A text link
          </span>
          <div className="h-2 w-full max-w-56 overflow-hidden rounded-full bg-muted sm:ml-auto">
            <div className="h-full w-2/3 rounded-full" style={{ background: brand }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TestEmailCard({ adminEmail, dirty }: { adminEmail: string; dirty: boolean }) {
  const test = useAction(sendTestEmail, {
    onSuccess: (data) => {
      if (data.provider === "log") {
        toast.info("No provider is set up yet, so the test was only written to the email log.");
      } else {
        toast.success(`Test email sent to ${data.to}`);
      }
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a test email</CardTitle>
        <CardDescription>
          Sends a short message to <span className="font-medium text-foreground">{adminEmail}</span> using the saved settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" loading={test.pending} disabled={dirty} onClick={() => test.run({})}>
          <Send />
          Send test email
        </Button>
        {dirty ? <p className="text-[0.8125rem] text-muted-foreground">Save your changes first.</p> : null}
        {test.error ? <p className="w-full text-[0.8125rem] font-medium text-danger-text">{test.error}</p> : null}
      </CardContent>
    </Card>
  );
}
