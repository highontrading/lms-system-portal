"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, FileUp, Upload } from "lucide-react";
import { toast } from "sonner";
import { importAccessBatch, type ImportRowResult } from "@/app/(admin)/admin/enrollments/actions";
import { Button } from "@/components/ui/button";
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
import { Checkbox, Field, Select, Textarea } from "@/components/ui/form";
import { Callout, ProgressBar } from "@/components/ui/misc";
import type { ProductChoice } from "@/components/admin/people/access-forms";

const MAX_ROWS = 2000;
const BATCH_SIZE = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXPIRY_PATTERN = /^(lifetime|\d{4}-\d{2}-\d{2})$/;

type ParsedRow = {
  line: number;
  email: string;
  name: string;
  product: string;
  expiry: string;
  problem: string | null;
};

/** Minimal CSV reader: commas or tabs, quoted fields, escaped quotes. */
function parseCsv(text: string) {
  const delimiter = text.includes("\t") && !text.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some((cell) => cell !== ""));
}

function interpret(text: string, fallbackProduct: string, known: Set<string>): ParsedRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];

  // Columns can be named in a header row; otherwise they are read as email, name, product, expiry.
  const header = table[0].map((cell) => cell.toLowerCase());
  const hasHeader = header.includes("email");
  const column = (names: string[], position: number) => {
    if (!hasHeader) return position;
    return header.findIndex((cell) => names.includes(cell));
  };
  const emailAt = column(["email", "e-mail", "email address"], 0);
  const nameAt = column(["name", "full name", "student"], 1);
  const productAt = column(["product", "sku", "slug", "course"], 2);
  const expiryAt = column(["expiry", "expires", "expires at", "access until"], 3);

  return table.slice(hasHeader ? 1 : 0).map((cells, index) => {
    const email = (cells[emailAt] ?? "").toLowerCase();
    const product = (productAt >= 0 ? cells[productAt] : "") || fallbackProduct;
    const expiry = (expiryAt >= 0 ? cells[expiryAt] : "") ?? "";
    let problem: string | null = null;
    if (!EMAIL_PATTERN.test(email)) problem = "Invalid email address";
    else if (!product) problem = "No product — add a product column or choose a default";
    else if (!known.has(product.toLowerCase())) problem = `Unknown product "${product}"`;
    else if (expiry && !EXPIRY_PATTERN.test(expiry.toLowerCase())) problem = "Expiry must be YYYY-MM-DD or lifetime";
    return {
      line: index + (hasHeader ? 2 : 1),
      email,
      name: nameAt >= 0 ? (cells[nameAt] ?? "") : "",
      product,
      expiry: expiry.toLowerCase(),
      problem,
    };
  });
}

const SAMPLE = `email,name,product,expiry
asha@example.org,Asha Verma,ai-automation-foundations,
rahul@example.org,Rahul Menon,DEMO-AGENT,2027-12-31`;

export function CsvImportDialog({ products }: { products: ProductChoice[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fallbackProduct, setFallbackProduct] = useState("");
  const [sendEmails, setSendEmails] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<ImportRowResult[] | null>(null);

  const known = useMemo(() => {
    const set = new Set<string>();
    for (const product of products) {
      set.add(product.id.toLowerCase());
      set.add(product.slug.toLowerCase());
      if (product.sku) set.add(product.sku.toLowerCase());
    }
    return set;
  }, [products]);

  const rows = useMemo(() => interpret(text, fallbackProduct, known), [text, fallbackProduct, known]);
  const valid = rows.filter((row) => !row.problem);
  const invalid = rows.filter((row) => row.problem);
  const tooMany = rows.length > MAX_ROWS;

  function reset() {
    setText("");
    setResults(null);
    setDone(0);
    setRunning(false);
  }

  async function run() {
    setRunning(true);
    setDone(0);
    const collected: ImportRowResult[] = [];
    for (let index = 0; index < valid.length; index += BATCH_SIZE) {
      const batch = valid.slice(index, index + BATCH_SIZE);
      const response = await importAccessBatch({
        rows: batch.map((row) => ({
          line: row.line,
          email: row.email,
          name: row.name || undefined,
          product: row.product,
          expiry: row.expiry || undefined,
        })),
        sendEmails,
      });
      if (!response.ok) {
        toast.error(response.error);
        collected.push(
          ...batch.map((row) => ({ line: row.line, email: row.email, status: "error" as const, message: response.error })),
        );
      } else {
        collected.push(...response.data.results);
      }
      setDone(Math.min(valid.length, index + batch.length));
    }
    setResults(collected);
    setRunning(false);
    router.refresh();
  }

  const summary = results
    ? {
        granted: results.filter((result) => result.status === "granted").length,
        newAccounts: results.filter((result) => result.newAccount).length,
        existing: results.filter((result) => result.status === "existing").length,
        errors: results.filter((result) => result.status === "error"),
      }
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <FileUp /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import access from a CSV</DialogTitle>
          <DialogDescription>
            Grant access to many people at once — for example a list of buyers exported from another platform.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <>
            <DialogBody className="grid gap-4">
              <Callout tone={summary.errors.length ? "warning" : "success"} icon={summary.errors.length ? <CircleAlert /> : <CircleCheck />} title="Import finished">
                {summary.granted} granted
                {summary.newAccounts ? ` (${summary.newAccounts} new account${summary.newAccounts === 1 ? "" : "s"})` : ""} ·{" "}
                {summary.existing} already had access · {summary.errors.length} failed
                {invalid.length ? ` · ${invalid.length} skipped as invalid` : ""}
              </Callout>
              {summary.errors.length > 0 ? (
                <div className="max-h-56 overflow-y-auto rounded-md border border-border text-sm">
                  {summary.errors.map((error) => (
                    <div key={error.line} className="flex gap-3 border-b border-border px-3 py-2 last:border-b-0">
                      <span className="shrink-0 tabular-nums text-muted-foreground">Line {error.line}</span>
                      <span className="min-w-0 flex-1 truncate">{error.email}</span>
                      <span className="shrink-0 text-danger-text">{error.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={reset}>
                Import another file
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogBody className="grid gap-4">
              <div className="rounded-md bg-muted px-3 py-2.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
                Columns: <span className="font-medium text-foreground">email, name, product, expiry</span>. Product is
                the product&apos;s slug, SKU or ID. Name and expiry (YYYY-MM-DD or “lifetime”) are optional. A header
                row is optional.{" "}
                <button type="button" className="font-medium text-primary-text hover:underline" onClick={() => setText(SAMPLE)}>
                  Insert an example
                </button>
              </div>

              <Field label="CSV data" htmlFor="csv-text">
                <Textarea
                  id="csv-text"
                  rows={7}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={"email,name,product\nbuyer@example.com,Their Name,your-product-slug"}
                  className="font-mono text-[0.8125rem]"
                  disabled={running}
                />
              </Field>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) toast.error("That file is larger than 2 MB. Split it into smaller files.");
                    else setText(await file.text());
                    event.target.value = "";
                  }}
                />
                <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={running}>
                  <Upload /> Choose a file
                </Button>
                <span className="text-[0.8125rem] text-muted-foreground">or paste the rows above</span>
              </div>

              <Field
                label="Product for rows without a product column"
                htmlFor="csv-default-product"
                optional
                hint="Handy when the whole file is the buyer list for one product."
              >
                <Select
                  id="csv-default-product"
                  value={fallbackProduct}
                  onChange={(event) => setFallbackProduct(event.target.value)}
                  disabled={running}
                >
                  <option value="">No default</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.slug}>
                      {product.title}
                    </option>
                  ))}
                </Select>
              </Field>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  checked={sendEmails}
                  onChange={(event) => setSendEmails(event.target.checked)}
                  className="mt-0.5"
                  disabled={running}
                />
                <span>
                  <span className="font-medium">Email everyone their access</span>
                  <span className="block text-[0.8125rem] text-muted-foreground">
                    Leave this off for a silent import, e.g. when moving existing students over.
                  </span>
                </span>
              </label>

              {rows.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{valid.length}</span> row{valid.length === 1 ? "" : "s"} ready
                    {invalid.length ? (
                      <>
                        {" "}
                        · <span className="font-medium text-danger-text">{invalid.length} with problems</span> (skipped)
                      </>
                    ) : null}
                  </p>
                  {tooMany ? (
                    <Callout tone="danger">
                      That&apos;s {rows.length.toLocaleString("en")} rows. Import up to {MAX_ROWS.toLocaleString("en")} at a
                      time — split the file and run it in parts.
                    </Callout>
                  ) : null}
                  <div className="max-h-48 overflow-auto rounded-md border border-border">
                    <table className="w-full min-w-max text-[0.8125rem]">
                      <thead className="sticky top-0 bg-subtle text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-1.5 font-medium">Line</th>
                          <th className="px-3 py-1.5 font-medium">Email</th>
                          <th className="px-3 py-1.5 font-medium">Name</th>
                          <th className="px-3 py-1.5 font-medium">Product</th>
                          <th className="px-3 py-1.5 font-medium">Expiry</th>
                          <th className="px-3 py-1.5 font-medium">Check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...invalid, ...valid].slice(0, 100).map((row) => (
                          <tr key={row.line} className="border-t border-border">
                            <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{row.line}</td>
                            <td className="px-3 py-1.5">{row.email || "—"}</td>
                            <td className="px-3 py-1.5">{row.name || "—"}</td>
                            <td className="px-3 py-1.5">{row.product || "—"}</td>
                            <td className="px-3 py-1.5">{row.expiry || "default"}</td>
                            <td className={row.problem ? "px-3 py-1.5 text-danger-text" : "px-3 py-1.5 text-success-text"}>
                              {row.problem ?? "Ready"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 100 ? (
                    <p className="text-xs text-muted-foreground">Showing the first 100 rows (problems first).</p>
                  ) : null}
                </div>
              ) : null}

              {running ? (
                <div className="grid gap-1.5">
                  <ProgressBar value={(done / Math.max(1, valid.length)) * 100} label="Import progress" />
                  <p className="text-[0.8125rem] text-muted-foreground">
                    Importing {done} of {valid.length}… keep this window open.
                  </p>
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={running}>
                Cancel
              </Button>
              <Button onClick={run} loading={running} disabled={valid.length === 0 || tooMany}>
                Import {valid.length > 0 ? `${valid.length} row${valid.length === 1 ? "" : "s"}` : ""}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
