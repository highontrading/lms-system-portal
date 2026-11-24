"use client";

import { useMemo, useState } from "react";
import type { Level, ProductType } from "@/generated/prisma/enums";
import { updateProductDetails } from "@/app/(admin)/admin/products/actions";
import { useAction } from "@/hooks/use-action";
import { LEVEL_LABELS } from "@/lib/labels";
import { slugify } from "@/lib/utils";
import { FaqEditor } from "@/components/admin/faq-editor";
import { ImageField } from "@/components/admin/image-field";
import { ListInput } from "@/components/admin/list-input";
import { SaveBar } from "@/components/admin/product/save-bar";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

export type DetailsValues = {
  title: string;
  slug: string;
  tagline: string;
  description: string;
  thumbnailUrl: string;
  categoryId: string;
  instructorIds: string[];
  level: Level;
  language: string;
  durationLabel: string;
  tags: string[];
  outcomes: string[];
  requirements: string[];
  audience: string[];
  faqs: { q: string; a: string }[];
  version: string;
  platform: string;
};

type Props = {
  productId: string;
  type: ProductType;
  initial: DetailsValues;
  categories: { id: string; name: string }[];
  instructors: { id: string; name: string; title: string | null }[];
};

const HAS_VERSION: ProductType[] = ["AGENT", "WORKFLOW", "DIGITAL"];

const COPY: Record<ProductType, { outcomes: string; outcomesHint: string; requirements: string; requirementsHint: string }> = {
  COURSE: {
    outcomes: "What students will learn",
    outcomesHint: "Short, concrete outcomes. Shown as a checklist on the product page.",
    requirements: "Requirements",
    requirementsHint: "What someone needs before starting.",
  },
  WORKSHOP: {
    outcomes: "What you'll cover",
    outcomesHint: "The takeaways from the live sessions.",
    requirements: "What to prepare",
    requirementsHint: "Accounts, tools or files attendees should have ready.",
  },
  AGENT: {
    outcomes: "What's included",
    outcomesHint: "What the buyer gets and what the agent does.",
    requirements: "What you need to run it",
    requirementsHint: "Accounts, API keys, plans or tools required.",
  },
  WORKFLOW: {
    outcomes: "What's included",
    outcomesHint: "What the buyer gets and what the workflow automates.",
    requirements: "What you need to run it",
    requirementsHint: "Accounts, API keys, plans or tools required.",
  },
  DIGITAL: {
    outcomes: "What's included",
    outcomesHint: "The files, templates or pages inside.",
    requirements: "Requirements",
    requirementsHint: "Anything needed to use it.",
  },
  BUNDLE: {
    outcomes: "Why get the bundle",
    outcomesHint: "The benefits of getting everything together.",
    requirements: "Requirements",
    requirementsHint: "Anything needed before starting.",
  },
};

export function DetailsForm({ productId, type, initial, categories, instructors }: Props) {
  const [saved, setSaved] = useState(initial);
  const [values, setValues] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(true);
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);
  const copy = COPY[type];

  const save = useAction(updateProductDetails, { success: "Changes saved" });
  const errors = save.fieldErrors;

  function set<K extends keyof DetailsValues>(key: K, value: DetailsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        // What is being saved becomes the new baseline once the server confirms it.
        const submitted: DetailsValues = {
          ...values,
          tags: values.tags.map((tag) => tag.trim()).filter(Boolean),
          outcomes: values.outcomes.map((item) => item.trim()).filter(Boolean),
          requirements: values.requirements.map((item) => item.trim()).filter(Boolean),
          audience: values.audience.map((item) => item.trim()).filter(Boolean),
          faqs: values.faqs.filter((faq) => faq.q.trim() && faq.a.trim()),
        };
        const result = await save.run({ id: productId, ...submitted, categoryId: submitted.categoryId || null });
        if (result.ok) {
          setValues(submitted);
          setSaved(submitted);
        }
      }}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>The name and one-line pitch students see everywhere.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Title" htmlFor="title" error={errors.title}>
                <Input
                  id="title"
                  value={values.title}
                  onChange={(event) => {
                    set("title", event.target.value);
                    if (!slugTouched) set("slug", slugify(event.target.value));
                  }}
                  aria-invalid={!!errors.title}
                  required
                />
              </Field>
              <Field
                label="Page address"
                htmlFor="slug"
                error={errors.slug}
                hint="Lowercase letters, numbers and dashes. Changing it breaks links people have already shared."
              >
                <div className="flex items-stretch">
                  <span className="hidden items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-[0.8125rem] text-muted-foreground sm:inline-flex">
                    /catalog/
                  </span>
                  <Input
                    id="slug"
                    value={values.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }}
                    className="sm:rounded-l-none"
                    aria-invalid={!!errors.slug}
                    required
                  />
                </div>
              </Field>
              <Field label="Tagline" htmlFor="tagline" error={errors.tagline} hint="One sentence shown under the title and on cards." optional>
                <Textarea
                  id="tagline"
                  rows={2}
                  value={values.tagline}
                  onChange={(event) => set("tagline", event.target.value)}
                  maxLength={200}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
              <CardDescription>The full write-up on the product page.</CardDescription>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={values.description}
                onChange={(html) => set("description", html)}
                placeholder="Describe what this is, who it's for and what they'll get…"
                minHeight={220}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product page content</CardTitle>
              <CardDescription>Short lists that help people understand what they&apos;re getting.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <Field label={copy.outcomes} hint={copy.outcomesHint}>
                <ListInput value={values.outcomes} onChange={(next) => set("outcomes", next)} placeholder="Add a point" />
              </Field>
              <Field label={copy.requirements} hint={copy.requirementsHint}>
                <ListInput value={values.requirements} onChange={(next) => set("requirements", next)} placeholder="Add a requirement" />
              </Field>
              <Field label="Who it's for" hint="Describe the people who will get the most from it.">
                <ListInput value={values.audience} onChange={(next) => set("audience", next)} placeholder="Add an audience" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frequently asked questions</CardTitle>
              <CardDescription>Answered on the product page. Rows with an empty question or answer aren&apos;t saved.</CardDescription>
            </CardHeader>
            <CardContent>
              <FaqEditor value={values.faqs} onChange={(next) => set("faqs", next)} />
            </CardContent>
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cover image</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageField
                value={values.thumbnailUrl}
                onChange={(url) => set("thumbnailUrl", url)}
                hint="16:9 works best (1280×720). Without one, a cover is generated for you."
              />
              {errors.thumbnailUrl ? <p className="mt-1.5 text-[0.8125rem] font-medium text-danger-text">{errors.thumbnailUrl}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field label="Category" htmlFor="category" optional>
                <Select id="category" value={values.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
                  <option value="">No category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Instructors" hint={instructors.length === 0 ? "Add instructors under Catalog → Instructors." : undefined} optional>
                {instructors.length > 0 ? (
                  <div className="grid max-h-52 gap-0.5 overflow-y-auto rounded-md border border-border p-1.5">
                    {instructors.map((instructor) => {
                      const checked = values.instructorIds.includes(instructor.id);
                      return (
                        <label
                          key={instructor.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted"
                        >
                          <Checkbox
                            checked={checked}
                            onChange={(event) =>
                              set(
                                "instructorIds",
                                event.target.checked
                                  ? [...values.instructorIds, instructor.id]
                                  : values.instructorIds.filter((value) => value !== instructor.id),
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{instructor.name}</span>
                            {instructor.title ? (
                              <span className="block truncate text-xs text-muted-foreground">{instructor.title}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Level" htmlFor="level">
                  <Select id="level" value={values.level} onChange={(event) => set("level", event.target.value as Level)}>
                    {(Object.keys(LEVEL_LABELS) as Level[]).map((level) => (
                      <option key={level} value={level}>
                        {LEVEL_LABELS[level]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Language" htmlFor="language">
                  <Input id="language" value={values.language} onChange={(event) => set("language", event.target.value)} />
                </Field>
              </div>

              <Field
                label="Length"
                htmlFor="duration"
                hint="Free text, e.g. “6 hours” or “2 live sessions”."
                optional
              >
                <Input id="duration" value={values.durationLabel} onChange={(event) => set("durationLabel", event.target.value)} />
              </Field>

              <Field label="Tags" hint="Used for search and filtering." optional>
                <ListInput value={values.tags} onChange={(next) => set("tags", next)} placeholder="e.g. n8n" addLabel="Add" />
              </Field>
            </CardContent>
          </Card>

          {HAS_VERSION.includes(type) ? (
            <Card>
              <CardHeader>
                <CardTitle>Version</CardTitle>
                <CardDescription>Shown to buyers so they know they have the latest files.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Current version" htmlFor="version" optional>
                  <Input id="version" value={values.version} onChange={(event) => set("version", event.target.value)} placeholder="1.0.0" />
                </Field>
                <Field label="Runs on" htmlFor="platform" hint="The tools it works with, e.g. “n8n · OpenAI”." optional>
                  <Input id="platform" value={values.platform} onChange={(event) => set("platform", event.target.value)} />
                </Field>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <SaveBar dirty={dirty} pending={save.pending} onReset={() => setValues(saved)} />
    </form>
  );
}
