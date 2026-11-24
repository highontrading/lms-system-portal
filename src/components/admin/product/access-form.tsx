"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, Info, TriangleAlert, X } from "lucide-react";
import type { ProductType, ProductVisibility } from "@/generated/prisma/enums";
import { updateProductAccess } from "@/app/(admin)/admin/products/actions";
import { useAction } from "@/hooks/use-action";
import { PRODUCT_TYPE_LABELS } from "@/lib/labels";
import { currencyDecimals, formatMoney, toMinorUnits } from "@/lib/utils";
import { SaveBar } from "@/components/admin/product/save-bar";
import { ProductTypeIcon } from "@/components/product/visuals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { Callout } from "@/components/ui/misc";

export type AccessValues = {
  checkoutUrl: string;
  /** What the admin typed, in major units ("4999" or "49.50"). */
  priceText: string;
  sku: string;
  limited: boolean;
  accessDays: string;
  seatsLimited: boolean;
  seatLimit: string;
  sequential: boolean;
  certificateEnabled: boolean;
  completionPercent: string;
  licenseKeysEnabled: boolean;
  bundleProductIds: string[];
};

type Props = {
  productId: string;
  type: ProductType;
  visibility: ProductVisibility;
  currency: string;
  locale: string;
  activeSeats: number;
  initial: AccessValues;
  bundleChoices: { id: string; title: string; type: ProductType }[];
};

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
  children,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground">{description}</span>
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
      {checked && children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function AccessForm({ productId, type, visibility, currency, locale, activeSeats, initial, bundleChoices }: Props) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const isBundle = type === "BUNDLE";

  const save = useAction(updateProductAccess, { success: "Access settings saved" });
  const errors = { ...save.fieldErrors, ...localErrors };

  function set<K extends keyof AccessValues>(key: K, value: AccessValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setLocalErrors({});
  }

  const priceNumber = values.priceText.trim() === "" ? 0 : Number(values.priceText.replace(/,/g, ""));
  const priceValid = Number.isFinite(priceNumber) && priceNumber >= 0;
  const priceMinor = priceValid ? toMinorUnits(priceNumber, currency) : 0;
  const hasLink = values.checkoutUrl.trim().length > 0;

  // Spell out what the choices above mean for a visitor, so nothing is opened up by accident.
  // The rule on the public page: a product without a price is free to join.
  const visitor =
    visibility === "PRIVATE"
      ? { tone: "neutral" as const, text: "This product is private: it has no public page. Only people you give access to can open it." }
      : priceMinor === 0
        ? {
            tone: "warning" as const,
            text: "With no price, this is free: any signed-in visitor can add it to their library themselves. If people pay for it elsewhere, enter the price — or make the product private under Settings.",
          }
        : hasLink
          ? {
              tone: "info" as const,
              text: `The product page shows the price ${formatMoney(priceMinor, currency, locale)} and a button that opens your purchase link. Buyers get access when your platform calls the API or you give it to them.`,
            }
          : {
              tone: "info" as const,
              text: `The product page shows the price ${formatMoney(priceMinor, currency, locale)} without a buy button. People get access when you give it to them.`,
            };

  const selectedBundle = values.bundleProductIds
    .map((id) => bundleChoices.find((choice) => choice.id === id))
    .filter((choice): choice is NonNullable<typeof choice> => !!choice);
  const remainingBundle = bundleChoices.filter((choice) => !values.bundleProductIds.includes(choice.id));

  function moveBundle(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= values.bundleProductIds.length) return;
    const next = [...values.bundleProductIds];
    [next[index], next[target]] = [next[target], next[index]];
    set("bundleProductIds", next);
  }

  async function submit() {
    const problems: Record<string, string> = {};
    if (!priceValid) problems.price = "Enter a number, e.g. 4999";
    else if (hasLink && priceMinor === 0) {
      problems.price = "Enter the price people pay. Without a price this product is free to join here.";
    }
    const days = Number(values.accessDays);
    if (values.limited && (!Number.isInteger(days) || days < 1)) problems.accessDays = "Enter a whole number of days";
    const seats = Number(values.seatLimit);
    if (values.seatsLimited && (!Number.isInteger(seats) || seats < 1)) problems.seatLimit = "Enter a whole number of seats";
    const percent = Number(values.completionPercent);
    if (values.certificateEnabled && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
      problems.completionPercent = "Between 1 and 100";
    }
    if (Object.keys(problems).length > 0) {
      setLocalErrors(problems);
      return;
    }
    const submitted = values;
    const result = await save.run({
      id: productId,
      checkoutUrl: values.checkoutUrl.trim(),
      price: priceMinor,
      sku: values.sku.trim(),
      accessDays: values.limited ? days : null,
      seatLimit: values.seatsLimited ? seats : null,
      sequential: values.sequential,
      certificateEnabled: values.certificateEnabled,
      completionPercent: values.certificateEnabled ? percent : 100,
      licenseKeysEnabled: values.licenseKeysEnabled,
      bundleProductIds: values.bundleProductIds,
    });
    if (result.ok) setSaved(submitted);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid max-w-3xl grid-cols-[minmax(0,1fr)] gap-6">
        <Callout tone="neutral" icon={<Info />}>
          This site doesn&apos;t take payments. People buy on your own platforms; here they get access — granted by you, by a
          CSV import, or automatically through the API.
        </Callout>

        <Card>
          <CardHeader>
            <CardTitle>Where people get this</CardTitle>
            <CardDescription>What the public product page offers to someone who doesn&apos;t have access yet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field
              label="Purchase link"
              htmlFor="checkoutUrl"
              error={errors.checkoutUrl}
              hint="The page on your website or payment platform where people buy this. It becomes the button on the product page."
              optional
            >
              <Input
                id="checkoutUrl"
                type="url"
                inputMode="url"
                value={values.checkoutUrl}
                onChange={(event) => set("checkoutUrl", event.target.value)}
                placeholder="https://yourstore.com/buy/this-product"
                aria-invalid={!!errors.checkoutUrl}
              />
            </Field>

            <Field
              label="Price shown on the product page"
              htmlFor="price"
              error={errors.price}
              hint={`For display only, in ${currency} — nothing is charged here. Leave it empty only if the product is free.`}
              optional
            >
              <div className="flex items-stretch">
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-[0.8125rem] font-medium text-muted-foreground">
                  {currency}
                </span>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={values.priceText}
                  onChange={(event) => set("priceText", event.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder={currencyDecimals(currency) === 0 ? "0" : "0.00"}
                  className="max-w-48 rounded-l-none"
                  aria-invalid={!!errors.price}
                />
              </div>
            </Field>

            <Callout tone={visitor.tone} icon={visitor.tone === "warning" ? <TriangleAlert /> : <Eye />} title="What visitors see">
              {visitor.text}
            </Callout>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matching purchases from other platforms</CardTitle>
            <CardDescription>
              When a sale happens elsewhere, the API call names this ID and the buyer gets this product. Set it up under
              Integrations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field
              label="External product ID (SKU)"
              htmlFor="sku"
              error={errors.sku}
              hint="Use the ID your store or payment platform has for this product. Must be unique."
              optional
            >
              <Input
                id="sku"
                value={values.sku}
                onChange={(event) => set("sku", event.target.value)}
                placeholder="e.g. ai-course-2026"
                className="max-w-sm font-mono text-[0.8125rem]"
                aria-invalid={!!errors.sku}
              />
            </Field>
          </CardContent>
        </Card>

        {isBundle ? (
          <Card>
            <CardHeader>
              <CardTitle>Included products</CardTitle>
              <CardDescription>Anyone who gets this bundle gets everything listed here, in this order.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {selectedBundle.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
                  No products yet. Add the first one below.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {selectedBundle.map((choice, index) => (
                    <li key={choice.id} className="flex items-center gap-2 rounded-lg border border-border bg-subtle/60 px-3 py-2">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">
                        <ProductTypeIcon type={choice.type} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{choice.title}</span>
                        <span className="block text-xs text-muted-foreground">{PRODUCT_TYPE_LABELS[choice.type]}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => moveBundle(index, -1)}
                        disabled={index === 0}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBundle(index, 1)}
                        disabled={index === selectedBundle.length - 1}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => set("bundleProductIds", values.bundleProductIds.filter((id) => id !== choice.id))}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
                        aria-label={`Remove ${choice.title}`}
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {remainingBundle.length > 0 ? (
                <Select
                  aria-label="Add a product to the bundle"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) set("bundleProductIds", [...values.bundleProductIds, event.target.value]);
                  }}
                >
                  <option value="">Add a product…</option>
                  {remainingBundle.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.title} — {PRODUCT_TYPE_LABELS[choice.type]}
                    </option>
                  ))}
                </Select>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Access rules</CardTitle>
            <CardDescription>Applied whenever someone is given this product.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <ToggleRow
              id="limited"
              title="Access expires"
              description="Off means lifetime access. Turn on to end access a set number of days after it is given."
              checked={values.limited}
              onChange={(checked) => set("limited", checked)}
            >
              <Field label="Days of access" htmlFor="accessDays" error={errors.accessDays}>
                <Input
                  id="accessDays"
                  inputMode="numeric"
                  value={values.accessDays}
                  onChange={(event) => set("accessDays", event.target.value.replace(/\D/g, ""))}
                  placeholder="365"
                  className="max-w-32"
                  aria-invalid={!!errors.accessDays}
                />
              </Field>
            </ToggleRow>

            <ToggleRow
              id="seatsLimited"
              title="Limit seats"
              description={`Stop new people joining once it's full. ${activeSeats.toLocaleString("en")} ${activeSeats === 1 ? "person has" : "people have"} access now.`}
              checked={values.seatsLimited}
              onChange={(checked) => set("seatsLimited", checked)}
            >
              <Field label="Seats" htmlFor="seatLimit" error={errors.seatLimit}>
                <Input
                  id="seatLimit"
                  inputMode="numeric"
                  value={values.seatLimit}
                  onChange={(event) => set("seatLimit", event.target.value.replace(/\D/g, ""))}
                  placeholder="100"
                  className="max-w-32"
                  aria-invalid={!!errors.seatLimit}
                />
              </Field>
            </ToggleRow>

            {isBundle ? null : (
              <>
                <ToggleRow
                  id="sequential"
                  title="Lessons must be done in order"
                  description="Each lesson unlocks when the one before it is completed."
                  checked={values.sequential}
                  onChange={(checked) => set("sequential", checked)}
                />

                <ToggleRow
                  id="certificateEnabled"
                  title="Certificate on completion"
                  description="Issued automatically, with a public verification link, when a student finishes."
                  checked={values.certificateEnabled}
                  onChange={(checked) => set("certificateEnabled", checked)}
                >
                  <Field
                    label="Lessons that must be completed"
                    htmlFor="completionPercent"
                    error={errors.completionPercent}
                    hint="Percent of published lessons. 100 means every lesson."
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        id="completionPercent"
                        inputMode="numeric"
                        value={values.completionPercent}
                        onChange={(event) => set("completionPercent", event.target.value.replace(/\D/g, ""))}
                        className="max-w-24"
                        aria-invalid={!!errors.completionPercent}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </Field>
                </ToggleRow>

                <ToggleRow
                  id="licenseKeysEnabled"
                  title="Give each buyer a licence key"
                  description="A unique key is created with their access and shown on the product's page in their library."
                  checked={values.licenseKeysEnabled}
                  onChange={(checked) => set("licenseKeysEnabled", checked)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <SaveBar dirty={dirty} pending={save.pending} onReset={() => setValues(saved)} />
    </form>
  );
}
