"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, Search, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatBytes } from "@/lib/utils";
import { uploadFile, UploadFailed, type UploadedFile, type UploadPurpose } from "@/lib/upload-client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";

/** Updates one query-string parameter and resets pagination. */
function useParamSetter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return { setParam, pending, searchParams };
}

/** Search box bound to a query-string parameter (default `q`), debounced. */
export function SearchInput({
  placeholder = "Search…",
  param = "q",
  className,
}: {
  placeholder?: string;
  param?: string;
  className?: string;
}) {
  const { setParam, pending, searchParams } = useParamSetter();
  const current = searchParams.get(param) ?? "";
  const [value, setValue] = useState(current);
  const [synced, setSynced] = useState(current);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow external changes to the URL (back button, "clear filters").
  if (synced !== current) {
    setSynced(current);
    setValue(current);
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function update(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setParam(param, next.trim()), 300);
  }

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-md border border-input bg-card pr-9 pl-9 text-sm shadow-xs transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
      />
      <span className="absolute top-1/2 right-2.5 -translate-y-1/2">
        {pending ? (
          <Spinner className="size-4" />
        ) : value ? (
          <button
            type="button"
            onClick={() => update("")}
            className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Dropdown bound to a query-string parameter. An option with value "" clears the filter. */
export function ParamSelect({
  param,
  options,
  label,
  className,
}: {
  param: string;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  const { setParam, pending, searchParams } = useParamSetter();
  return (
    <div className={cn("w-full sm:w-auto sm:min-w-40", pending && "opacity-70", className)}>
      <Select aria-label={label} value={searchParams.get(param) ?? ""} onChange={(event) => setParam(param, event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  toastMessage,
  iconOnly,
  ...props
}: Omit<ButtonProps, "value" | "onClick"> & {
  value: string;
  label?: string;
  copiedLabel?: string;
  toastMessage?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (toastMessage) toast.success(toastMessage);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }

  return (
    <Button variant="secondary" size="sm" {...props} onClick={copy} aria-label={iconOnly ? label : undefined}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {iconOnly ? null : copied ? copiedLabel : label}
    </Button>
  );
}

/** Button that picks a file, uploads it with a progress read-out and hands back the stored file. */
export function UploadButton({
  purpose,
  accept,
  onUploaded,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  purpose: UploadPurpose;
  accept?: string;
  onUploaded: (file: UploadedFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function handle(file: File) {
    setProgress(0);
    try {
      const uploaded = await uploadFile(file, purpose, { onProgress: setProgress });
      onUploaded(uploaded);
    } catch (error) {
      toast.error(error instanceof UploadFailed ? error.message : "The upload failed. Please try again.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const uploading = progress !== null;
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handle(file);
        }}
      />
      <Button variant="secondary" {...props} disabled={uploading || props.disabled} onClick={() => inputRef.current?.click()}>
        {uploading ? (
          <>
            <Spinner className="size-4" />
            Uploading {Math.round((progress ?? 0) * 100)}%
          </>
        ) : (
          (children ?? (
            <>
              <Upload />
              Upload file
            </>
          ))
        )}
      </Button>
    </>
  );
}

export function FileSize({ bytes }: { bytes: number | null | undefined }) {
  return <span className="tabular-nums">{formatBytes(bytes)}</span>;
}
