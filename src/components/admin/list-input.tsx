"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

/** Editor for a short list of text lines: add, edit in place, reorder, remove. */
export function ListInput({
  value,
  onChange,
  placeholder = "Add an item",
  addLabel = "Add",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (!text) return;
    onChange([...value, text]);
    setDraft("");
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-2">
      {value.length > 0 ? (
        <ul className="grid gap-1.5">
          {value.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              <Input
                value={item}
                onChange={(event) => onChange(value.map((entry, i) => (i === index ? event.target.value : entry)))}
                onBlur={() => {
                  // Tidy up: trim, and drop lines that were emptied.
                  const cleaned = value.map((entry) => entry.trim());
                  if (cleaned.some((entry, i) => entry !== value[i] || entry === "")) {
                    onChange(cleaned.filter(Boolean));
                  }
                }}
                aria-label={`Item ${index + 1}`}
                className="h-9"
              />
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                aria-label="Move up"
              >
                <ArrowUp className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === value.length - 1}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                aria-label="Move down"
              >
                <ArrowDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
                aria-label="Remove"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-9"
        />
        <Button variant="secondary" size="sm" onClick={add} disabled={!draft.trim()} className="h-9 shrink-0">
          <Plus /> {addLabel}
        </Button>
      </div>
    </div>
  );
}
