"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UploadButton } from "@/components/ui/controls";
import { Input, Label } from "@/components/ui/form";

// Sizes respond to the width of the field itself (container queries), so the same component
// works in a narrow sidebar card and in a wide form.
const ASPECTS = {
  video: "aspect-video w-full @sm:w-56",
  square: "aspect-square w-24",
  wide: "aspect-[3/1] w-full @sm:w-64",
} as const;

/** Image picker: upload a file or paste a URL, with a live preview. */
export function ImageField({
  value,
  onChange,
  label,
  hint,
  purpose = "media",
  aspect = "video",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  purpose?: "media" | "avatar";
  aspect?: "video" | "square" | "wide";
}) {
  return (
    <div className="@container grid min-w-0 gap-1.5">
      {label ? <Label>{label}</Label> : null}
      <div className={cn("flex gap-3", aspect === "square" ? "flex-row items-start" : "flex-col @sm:flex-row @sm:items-start")}>
        <div
          className={cn(
            "relative shrink-0 overflow-hidden border border-border bg-muted",
            aspect === "square" ? "rounded-full" : "rounded-lg",
            ASPECTS[aspect],
          )}
        >
          {value ? (
            <img src={value} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-muted-foreground/60">
              <ImageIcon className="size-6" aria-hidden />
            </div>
          )}
        </div>
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap gap-2">
            <UploadButton
              purpose={purpose}
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              size="sm"
              onUploaded={(file) => onChange(file.url)}
            >
              <Upload /> {value ? "Replace" : "Upload image"}
            </UploadButton>
            {value ? (
              <Button variant="ghost" size="sm" onClick={() => onChange("")}>
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="…or paste an image URL"
            aria-label={label ? `${label} URL` : "Image URL"}
            className="h-9 text-[0.8125rem]"
          />
          {hint ? <p className="text-[0.8125rem] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
