"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/form";

type Faq = { q: string; a: string };

/** Question-and-answer list editor. */
export function FaqEditor({ value, onChange }: { value: Faq[]; onChange: (v: Faq[]) => void }) {
  function update(index: number, patch: Partial<Faq>) {
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="grid gap-3">
      {value.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-border bg-subtle/60 p-3">
          <div className="flex items-center gap-1">
            <Input
              value={item.q}
              onChange={(event) => update(index, { q: event.target.value })}
              placeholder="Question"
              aria-label={`Question ${index + 1}`}
              className="h-9 font-medium"
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
              aria-label="Remove question"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
          <Textarea
            value={item.a}
            onChange={(event) => update(index, { a: event.target.value })}
            placeholder="Answer"
            aria-label={`Answer ${index + 1}`}
            rows={2}
          />
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" onClick={() => onChange([...value, { q: "", a: "" }])}>
          <Plus /> Add question
        </Button>
      </div>
    </div>
  );
}
