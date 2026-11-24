"use client";

import { ArrowDown, ArrowUp, CircleHelp, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/interactive";
import { EmptyState } from "@/components/ui/misc";

export type QuizOptionDraft = { id: string; text: string; correct: boolean };

export type QuizQuestionDraft = {
  /** Stable key for React; the saved id is kept separately. */
  key: string;
  id?: string;
  type: "SINGLE" | "MULTIPLE" | "TRUE_FALSE";
  prompt: string;
  options: QuizOptionDraft[];
  explanation: string;
  points: number;
};

export type QuizDraft = {
  passPercent: number;
  maxAttempts: number | null;
  showAnswers: boolean;
  questions: QuizQuestionDraft[];
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `o${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function trueFalseOptions(correct: "true" | "false" = "true"): QuizOptionDraft[] {
  return [
    { id: "true", text: "True", correct: correct === "true" },
    { id: "false", text: "False", correct: correct === "false" },
  ];
}

export function emptyQuestion(): QuizQuestionDraft {
  return {
    key: newId(),
    type: "SINGLE",
    prompt: "",
    options: [
      { id: newId(), text: "", correct: true },
      { id: newId(), text: "", correct: false },
    ],
    explanation: "",
    points: 1,
  };
}

const TYPE_LABELS = { SINGLE: "One correct answer", MULTIPLE: "Several correct answers", TRUE_FALSE: "True or false" } as const;

function QuestionCard({
  index,
  total,
  question,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  question: QuizQuestionDraft;
  onChange: (next: QuizQuestionDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const multiple = question.type === "MULTIPLE";
  const fixed = question.type === "TRUE_FALSE";
  const hasCorrect = question.options.some((option) => option.correct);

  function setType(type: QuizQuestionDraft["type"]) {
    if (type === question.type) return;
    if (type === "TRUE_FALSE") return onChange({ ...question, type, options: trueFalseOptions() });
    let options = question.type === "TRUE_FALSE"
      ? [
          { id: newId(), text: "", correct: true },
          { id: newId(), text: "", correct: false },
        ]
      : question.options;
    if (type === "SINGLE") {
      // Keep only the first marked answer as correct.
      const firstCorrect = options.findIndex((option) => option.correct);
      options = options.map((option, optionIndex) => ({ ...option, correct: optionIndex === Math.max(0, firstCorrect) }));
    }
    onChange({ ...question, type, options });
  }

  function markCorrect(optionId: string, checked: boolean) {
    onChange({
      ...question,
      options: question.options.map((option) =>
        multiple
          ? option.id === optionId
            ? { ...option, correct: checked }
            : option
          : { ...option, correct: option.id === optionId },
      ),
    });
  }

  return (
    <li className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex items-center gap-2 border-b border-border bg-subtle/70 px-3 py-2 sm:px-4">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-text tabular-nums">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{question.prompt.trim() || "New question"}</span>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move question up"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label="Move question down"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="size-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Delete question"
          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-danger-soft hover:text-danger-text"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid gap-4 p-3 sm:p-4">
        <Field label="Question" htmlFor={`q-${question.key}`}>
          <Textarea
            id={`q-${question.key}`}
            rows={2}
            value={question.prompt}
            onChange={(event) => onChange({ ...question, prompt: event.target.value })}
            placeholder="What do you want to ask?"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <Field label="Answer type" htmlFor={`t-${question.key}`}>
            <Select id={`t-${question.key}`} value={question.type} onChange={(event) => setType(event.target.value as QuizQuestionDraft["type"])}>
              {(Object.keys(TYPE_LABELS) as QuizQuestionDraft["type"][]).map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Points" htmlFor={`p-${question.key}`}>
            <Input
              id={`p-${question.key}`}
              type="number"
              min={1}
              max={100}
              inputMode="numeric"
              value={question.points}
              onChange={(event) => onChange({ ...question, points: Math.max(1, Math.min(100, Math.round(Number(event.target.value) || 1))) })}
            />
          </Field>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[0.8125rem] font-medium">
            Answers{" "}
            <span className="font-normal text-muted-foreground">— tick the correct {multiple ? "ones" : "one"}</span>
          </legend>
          {question.options.map((option, optionIndex) => (
            <div key={option.id} className="flex items-center gap-2">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`correct-${question.key}`}
                checked={option.correct}
                onChange={(event) => markCorrect(option.id, event.target.checked)}
                aria-label={`Mark answer ${optionIndex + 1} as correct`}
                className="size-4.5 shrink-0 cursor-pointer accent-[var(--brand)]"
              />
              <Input
                value={option.text}
                readOnly={fixed}
                onChange={(event) =>
                  onChange({
                    ...question,
                    options: question.options.map((item) => (item.id === option.id ? { ...item, text: event.target.value } : item)),
                  })
                }
                placeholder={`Answer ${optionIndex + 1}`}
                aria-label={`Answer ${optionIndex + 1}`}
                className={cn(option.correct && "border-success/60 bg-success-soft/40", fixed && "bg-muted")}
              />
              {!fixed ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...question, options: question.options.filter((item) => item.id !== option.id) })}
                  disabled={question.options.length <= 2}
                  aria-label={`Remove answer ${optionIndex + 1}`}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          {!hasCorrect ? <p className="text-[0.8125rem] font-medium text-danger-text">Mark at least one answer as correct.</p> : null}
          {!fixed && question.options.length < 10 ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => onChange({ ...question, options: [...question.options, { id: newId(), text: "", correct: false }] })}
            >
              <Plus /> Add answer
            </Button>
          ) : null}
        </fieldset>

        <Field label="Explanation" htmlFor={`e-${question.key}`} optional hint="Shown after the student submits, if answers are revealed.">
          <Textarea
            id={`e-${question.key}`}
            rows={2}
            value={question.explanation}
            onChange={(event) => onChange({ ...question, explanation: event.target.value })}
          />
        </Field>
      </div>
    </li>
  );
}

export function QuizBuilder({ value, onChange }: { value: QuizDraft; onChange: (next: QuizDraft) => void }) {
  const totalPoints = value.questions.reduce((sum, question) => sum + question.points, 0);

  function updateQuestion(index: number, next: QuizQuestionDraft) {
    onChange({ ...value, questions: value.questions.map((question, i) => (i === index ? next : question)) });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.questions.length) return;
    const questions = [...value.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    onChange({ ...value, questions });
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:grid-cols-3 sm:p-5">
        <Field label="Pass mark (%)" htmlFor="quiz-pass" hint="Score needed to complete the lesson.">
          <Input
            id="quiz-pass"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={value.passPercent}
            onChange={(event) => onChange({ ...value, passPercent: Math.max(1, Math.min(100, Math.round(Number(event.target.value) || 1))) })}
          />
        </Field>
        <Field label="Attempts allowed" htmlFor="quiz-attempts" optional hint="Leave empty for unlimited.">
          <Input
            id="quiz-attempts"
            type="number"
            min={1}
            max={100}
            inputMode="numeric"
            value={value.maxAttempts ?? ""}
            onChange={(event) => {
              const raw = event.target.value.trim();
              onChange({ ...value, maxAttempts: raw === "" ? null : Math.max(1, Math.min(100, Math.round(Number(raw) || 1))) });
            }}
            placeholder="Unlimited"
          />
        </Field>
        <div className="flex items-start justify-between gap-3 sm:flex-col sm:justify-start">
          <div>
            <p className="text-[0.8125rem] font-medium">Reveal answers</p>
            <p className="text-[0.8125rem] leading-snug text-muted-foreground">Show correct answers and explanations after submitting.</p>
          </div>
          <Switch
            checked={value.showAnswers}
            onCheckedChange={(checked) => onChange({ ...value, showAnswers: checked })}
            aria-label="Reveal answers after submitting"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">Questions</h2>
          <p className="text-sm text-muted-foreground">
            {value.questions.length === 0
              ? "Add the questions students must answer."
              : `${value.questions.length} ${value.questions.length === 1 ? "question" : "questions"} · ${totalPoints} ${totalPoints === 1 ? "point" : "points"} in total`}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onChange({ ...value, questions: [...value.questions, emptyQuestion()] })}>
          <Plus /> Add question
        </Button>
      </div>

      {value.questions.length === 0 ? (
        <EmptyState
          compact
          icon={<CircleHelp />}
          title="No questions yet"
          description="A quiz needs at least one question before it can be published."
          action={
            <Button variant="soft" size="sm" onClick={() => onChange({ ...value, questions: [emptyQuestion()] })}>
              <Plus /> Add the first question
            </Button>
          }
        />
      ) : (
        <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          {value.questions.map((question, index) => (
            <QuestionCard
              key={question.key}
              index={index}
              total={value.questions.length}
              question={question}
              onChange={(next) => updateQuestion(index, next)}
              onMove={(direction) => moveQuestion(index, direction)}
              onRemove={() => onChange({ ...value, questions: value.questions.filter((_, i) => i !== index) })}
            />
          ))}
        </ul>
      )}

      {value.questions.length > 2 ? (
        <Button variant="secondary" className="w-fit" onClick={() => onChange({ ...value, questions: [...value.questions, emptyQuestion()] })}>
          <Plus /> Add question
        </Button>
      ) : null}
    </div>
  );
}
