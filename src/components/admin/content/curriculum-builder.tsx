"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AppWindow,
  ArrowRightLeft,
  CircleHelp,
  Clock,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Trash2,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import { useAction } from "@/hooks/use-action";
import { LESSON_TYPE_DESCRIPTIONS, LESSON_TYPE_LABELS } from "@/lib/labels";
import { cn, formatDuration, pluralize } from "@/lib/utils";
import {
  createLesson,
  createSection,
  deleteLesson,
  deleteSection,
  reorderCurriculum,
  updateLessonMeta,
  updateSection,
} from "@/server/admin/content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";

export type BuilderLesson = {
  id: string;
  title: string;
  type: LessonType;
  isPublished: boolean;
  isPreview: boolean;
  durationSeconds: number | null;
};

export type BuilderSection = {
  id: string;
  title: string;
  dripDays: number | null;
  lessons: BuilderLesson[];
};

export const LESSON_ICONS: Record<LessonType, LucideIcon> = {
  VIDEO: Video,
  TEXT: FileText,
  QUIZ: CircleHelp,
  ASSIGNMENT: Pencil,
  DOWNLOAD: Download,
  EMBED: AppWindow,
};

/** Lesson types offered when creating a lesson. */
const CREATABLE_TYPES: LessonType[] = ["VIDEO", "TEXT", "QUIZ", "DOWNLOAD", "EMBED"];

function DragHandle({
  label,
  attributes,
  listeners,
  setRef,
}: {
  label: string;
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
}) {
  return (
    <button
      type="button"
      ref={setRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      className="grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
}

// ───────────────────────────── Lesson row ─────────────────────────────

function LessonRow({
  productId,
  lesson,
  sections,
  sectionId,
  onMove,
}: {
  productId: string;
  lesson: BuilderLesson;
  sections: BuilderSection[];
  sectionId: string;
  onMove: (lessonId: string, toSectionId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const meta = useAction(updateLessonMeta);
  const remove = useAction(deleteLesson, { success: "Lesson deleted", onSuccess: () => setConfirmDelete(false) });
  const Icon = LESSON_ICONS[lesson.type];
  const href = `/admin/products/${productId}/lessons/${lesson.id}`;
  const otherSections = sections.filter((section) => section.id !== sectionId);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 border-t border-border bg-card py-1.5 pr-2 pl-1.5 first:border-t-0 sm:gap-2 sm:pl-2",
        isDragging && "relative z-10 rounded-lg border-t-0 shadow-lg ring-1 ring-border",
      )}
    >
      <DragHandle label={`Reorder lesson ${lesson.title}`} attributes={attributes} listeners={listeners} setRef={setActivatorNodeRef} />
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-soft text-primary-text">
        <Icon className="size-4" />
      </span>
      <Link href={href} className="group min-w-0 flex-1 py-1">
        <span className="block truncate text-sm font-medium group-hover:text-primary-text">{lesson.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {LESSON_TYPE_LABELS[lesson.type]}
          {lesson.durationSeconds ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(lesson.durationSeconds)}
            </span>
          ) : null}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        {lesson.isPreview ? (
          <Badge variant="info" size="sm" className="hidden sm:inline-flex">
            Free preview
          </Badge>
        ) : null}
        {lesson.isPublished ? null : (
          <Badge variant="warning" size="sm">
            Draft
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Actions for ${lesson.title}`}
          >
            <Ellipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-52">
            <DropdownMenuItem asChild>
              <Link href={href}>
                <Pencil /> Edit lesson
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={meta.pending}
              onSelect={() => meta.run({ productId, lessonId: lesson.id, isPublished: !lesson.isPublished })}
            >
              {lesson.isPublished ? <EyeOff /> : <Eye />}
              {lesson.isPublished ? "Unpublish (hide from students)" : "Publish"}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={meta.pending}
              onSelect={() => meta.run({ productId, lessonId: lesson.id, isPreview: !lesson.isPreview })}
            >
              <Eye />
              {lesson.isPreview ? "Remove free preview" : "Make a free preview"}
            </DropdownMenuItem>
            {otherSections.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Move to section</DropdownMenuLabel>
                {otherSections.map((section) => (
                  <DropdownMenuItem key={section.id} onSelect={() => onMove(lesson.id, section.id)}>
                    <ArrowRightLeft />
                    <span className="truncate">{section.title}</span>
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete lesson
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${lesson.title}”?`}
        description="Students' progress, notes and quiz attempts for this lesson are deleted with it. This can't be undone."
        confirmLabel="Delete lesson"
        loading={remove.pending}
        onConfirm={async () => {
          await remove.run({ productId, lessonId: lesson.id });
        }}
      />
    </li>
  );
}

// ───────────────────────────── Section card ─────────────────────────────

function SectionCard({
  productId,
  section,
  sections,
  onLessonsReordered,
  onMoveLesson,
  onEdit,
  onAddLesson,
}: {
  productId: string;
  section: BuilderSection;
  sections: BuilderSection[];
  onLessonsReordered: (sectionId: string, lessons: BuilderLesson[]) => void;
  onMoveLesson: (lessonId: string, toSectionId: string) => void;
  onEdit: (section: BuilderSection) => void;
  onAddLesson: (section: BuilderSection) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useAction(deleteSection, { success: "Section deleted", onSuccess: () => setConfirmDelete(false) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = section.lessons.findIndex((lesson) => lesson.id === active.id);
    const to = section.lessons.findIndex((lesson) => lesson.id === over.id);
    if (from < 0 || to < 0) return;
    onLessonsReordered(section.id, arrayMove(section.lessons, from, to));
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        isDragging && "relative z-20 shadow-lg ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-subtle/70 py-2 pr-2 pl-1.5 sm:gap-2 sm:pl-2">
        <DragHandle label={`Reorder section ${section.title}`} attributes={attributes} listeners={listeners} setRef={setActivatorNodeRef} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[0.9375rem] font-semibold tracking-tight">{section.title}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {pluralize(section.lessons.length, "lesson")}
            {section.dripDays ? (
              <span className="inline-flex items-center gap-1 text-warning-text">
                <Clock className="size-3" />
                Unlocks {section.dripDays} {section.dripDays === 1 ? "day" : "days"} after enrolment
              </span>
            ) : null}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onAddLesson(section)} className="hidden sm:inline-flex">
          <Plus /> Add lesson
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Actions for section ${section.title}`}
          >
            <Ellipsis className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => onAddLesson(section)}>
              <Plus /> Add lesson
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEdit(section)}>
              <Pencil /> Rename / schedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 /> Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {section.lessons.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-7 text-center">
          <p className="text-sm text-muted-foreground">No lessons in this section yet.</p>
          <Button variant="soft" size="sm" onClick={() => onAddLesson(section)}>
            <Plus /> Add the first lesson
          </Button>
        </div>
      ) : (
        <DndContext id={`lessons-${section.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={section.lessons.map((lesson) => lesson.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {section.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  productId={productId}
                  lesson={lesson}
                  sections={sections}
                  sectionId={section.id}
                  onMove={onMoveLesson}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${section.title}”?`}
        description={
          section.lessons.length > 0
            ? `This also deletes its ${pluralize(section.lessons.length, "lesson")} and students' progress on them. This can't be undone.`
            : "This section is empty and will be removed."
        }
        confirmLabel="Delete section"
        loading={remove.pending}
        onConfirm={async () => {
          await remove.run({ productId, sectionId: section.id });
        }}
      />
    </li>
  );
}

// ───────────────────────────── Dialogs ─────────────────────────────

function SectionDialog({
  productId,
  section,
  open,
  onOpenChange,
}: {
  productId: string;
  section: BuilderSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [title, setTitle] = useState(section?.title ?? "");
  const [drip, setDrip] = useState(section?.dripDays ? String(section.dripDays) : "");
  const create = useAction(createSection, { success: "Section added", onSuccess: () => onOpenChange(false) });
  const update = useAction(updateSection, { success: "Section saved", onSuccess: () => onOpenChange(false) });
  const pending = create.pending || update.pending;
  const errors = section ? update.fieldErrors : create.fieldErrors;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (section) {
      const days = drip.trim() === "" ? null : Math.max(0, Math.round(Number(drip)));
      update.run({ productId, sectionId: section.id, title, dripDays: Number.isFinite(days) ? days : null });
    } else {
      create.run({ productId, title });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{section ? "Edit section" : "Add a section"}</DialogTitle>
            <DialogDescription>Sections group lessons into modules, weeks or steps.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <Field label="Section title" htmlFor="section-title" error={errors.title}>
              <Input
                id="section-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Getting started"
                autoFocus
                required
              />
            </Field>
            {section ? (
              <Field
                label="Unlock after (days)"
                htmlFor="section-drip"
                optional
                hint="Leave empty to make it available straight away. Otherwise students can open it this many days after they get access."
                error={errors.dripDays}
              >
                <Input
                  id="section-drip"
                  type="number"
                  min={0}
                  max={3650}
                  inputMode="numeric"
                  value={drip}
                  onChange={(event) => setDrip(event.target.value)}
                  placeholder="0"
                />
              </Field>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {section ? "Save section" : "Add section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddLessonDialog({
  productId,
  section,
  open,
  onOpenChange,
}: {
  productId: string;
  section: BuilderSection | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<LessonType>("VIDEO");
  const [title, setTitle] = useState("");
  const create = useAction(createLesson, {
    onSuccess: (data) => {
      onOpenChange(false);
      router.push(`/admin/products/${productId}/lessons/${data.id}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (section) create.run({ productId, sectionId: section.id, title, type: type as "VIDEO" | "TEXT" | "QUIZ" | "DOWNLOAD" | "EMBED" });
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a lesson</DialogTitle>
            <DialogDescription>{section ? `To “${section.title}”. It starts as a draft.` : null}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-[0.8125rem] font-medium">Lesson type</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CREATABLE_TYPES.map((option) => {
                  const Icon = LESSON_ICONS[option];
                  const selected = option === type;
                  return (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        selected ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name="lesson-type"
                        value={option}
                        checked={selected}
                        onChange={() => setType(option)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-md",
                          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{LESSON_TYPE_LABELS[option]}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">{LESSON_TYPE_DESCRIPTIONS[option]}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Lesson title" htmlFor="lesson-title" error={create.fieldErrors.title}>
              <Input
                id="lesson-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Welcome and how this works"
                required
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={create.pending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.pending}>
              Add and edit lesson
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Builder ─────────────────────────────

export function CurriculumBuilder({ productId, sections: initial }: { productId: string; sections: BuilderSection[] }) {
  const [sections, setSections] = useState(initial);
  const [sectionDialog, setSectionDialog] = useState<{ open: boolean; section: BuilderSection | null }>({
    open: false,
    section: null,
  });
  const [lessonDialog, setLessonDialog] = useState<{ open: boolean; section: BuilderSection | null }>({
    open: false,
    section: null,
  });
  const reorder = useAction(reorderCurriculum, { onError: () => setSections(initial) });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(next: BuilderSection[]) {
    setSections(next);
    reorder.run({
      productId,
      sections: next.map((section) => ({ id: section.id, lessonIds: section.lessons.map((lesson) => lesson.id) })),
    });
  }

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((section) => section.id === active.id);
    const to = sections.findIndex((section) => section.id === over.id);
    if (from < 0 || to < 0) return;
    persist(arrayMove(sections, from, to));
  }

  function moveLesson(lessonId: string, toSectionId: string) {
    const lesson = sections.flatMap((section) => section.lessons).find((item) => item.id === lessonId);
    if (!lesson) return;
    persist(
      sections.map((section) => {
        const without = section.lessons.filter((item) => item.id !== lessonId);
        return section.id === toSectionId ? { ...section, lessons: [...without, lesson] } : { ...section, lessons: without };
      }),
    );
  }

  const lessonCount = sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const draftCount = sections.reduce((sum, section) => sum + section.lessons.filter((lesson) => !lesson.isPublished).length, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">Content</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sections.length === 0
              ? "Build the lessons students work through."
              : `${pluralize(sections.length, "section")} · ${pluralize(lessonCount, "lesson")}${draftCount ? ` · ${draftCount} still in draft` : ""}. Drag the handles to reorder.`}
          </p>
        </div>
        <Button onClick={() => setSectionDialog({ open: true, section: null })}>
          <Plus /> Add section
        </Button>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No content yet"
          description="Start with a section — a module, week or step — then add video, article, quiz, download or embed lessons to it."
          action={
            <Button onClick={() => setSectionDialog({ open: true, section: null })}>
              <Plus /> Add the first section
            </Button>
          }
        />
      ) : (
        <DndContext id="curriculum-sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            <ul className="grid gap-4">
              {sections.map((section) => (
                <SectionCard
                  key={section.id}
                  productId={productId}
                  section={section}
                  sections={sections}
                  onLessonsReordered={(sectionId, lessons) =>
                    persist(sections.map((item) => (item.id === sectionId ? { ...item, lessons } : item)))
                  }
                  onMoveLesson={moveLesson}
                  onEdit={(target) => setSectionDialog({ open: true, section: target })}
                  onAddLesson={(target) => setLessonDialog({ open: true, section: target })}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Keyed so each opening starts from fresh field values. */}
      <SectionDialog
        key={`section-${sectionDialog.section?.id ?? "new"}-${sectionDialog.open}`}
        productId={productId}
        section={sectionDialog.section}
        open={sectionDialog.open}
        onOpenChange={(open) => setSectionDialog((current) => ({ ...current, open }))}
      />
      <AddLessonDialog
        key={`lesson-${lessonDialog.section?.id ?? "none"}-${lessonDialog.open}`}
        productId={productId}
        section={lessonDialog.section}
        open={lessonDialog.open}
        onOpenChange={(open) => setLessonDialog((current) => ({ ...current, open }))}
      />
    </div>
  );
}
