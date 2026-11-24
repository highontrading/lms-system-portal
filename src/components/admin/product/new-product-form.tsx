"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { ProductType } from "@/generated/prisma/enums";
import { createProduct } from "@/app/(admin)/admin/products/actions";
import { useAction } from "@/hooks/use-action";
import { PRODUCT_TYPE_DESCRIPTIONS, PRODUCT_TYPE_LABELS, PRODUCT_TYPES } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ProductTypeIcon } from "@/components/product/visuals";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";

export function NewProductForm() {
  const [type, setType] = useState<ProductType>("COURSE");
  const [title, setTitle] = useState("");
  const create = useAction(createProduct);

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        create.run({ type, title });
      }}
    >
      <fieldset>
        <legend className="mb-3 text-sm font-medium">What kind of product is it?</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_TYPES.map((value) => {
            const selected = value === type;
            return (
              <label
                key={value}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors",
                  selected ? "border-primary ring-3 ring-ring/25" : "border-border hover:border-border-strong",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={selected}
                  onChange={() => setType(value)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-lg",
                      selected ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-text",
                    )}
                  >
                    <ProductTypeIcon type={value} className="size-4.5" />
                  </span>
                  {selected ? (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </span>
                <span className="font-display text-[0.9375rem] font-semibold tracking-tight">{PRODUCT_TYPE_LABELS[value]}</span>
                <span className="text-[0.8125rem] leading-snug text-muted-foreground">{PRODUCT_TYPE_DESCRIPTIONS[value]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Card>
        <CardContent className="grid gap-4">
          <Field
            label="Title"
            htmlFor="title"
            error={create.fieldErrors.title}
            hint="You can change this any time. The page address is generated from it."
          >
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={`e.g. ${type === "COURSE" ? "AI Automation Foundations" : type === "WORKSHOP" ? "Build an AI agent — live" : type === "AGENT" ? "Inbox Triage Agent" : type === "WORKFLOW" ? "Lead-to-CRM Automation" : type === "BUNDLE" ? "Automation Starter Bundle" : "Prompt Starter Pack"}`}
              autoFocus
              required
              aria-invalid={!!create.fieldErrors.title}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" loading={create.pending} disabled={title.trim().length < 2}>
              Create draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
