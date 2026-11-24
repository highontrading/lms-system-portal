import {
  CirclePlay,
  ClipboardList,
  CodeXml,
  Download,
  FileText,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { LessonType } from "@/generated/prisma/enums";
import type { LockReason } from "@/lib/curriculum";

export const LESSON_TYPE_ICONS: Record<LessonType, LucideIcon> = {
  VIDEO: CirclePlay,
  TEXT: FileText,
  QUIZ: ListChecks,
  ASSIGNMENT: ClipboardList,
  DOWNLOAD: Download,
  EMBED: CodeXml,
};

export type LockState = { locked: boolean; reason?: LockReason; unlockAt?: string };

/** Plain-language reason a lesson can't be opened yet. */
export function lockMessage(lock: LockState | undefined, locale = "en-IN") {
  if (!lock?.locked) return null;
  if (lock.reason === "drip" && lock.unlockAt) {
    const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(lock.unlockAt));
    return `Unlocks on ${date}`;
  }
  if (lock.reason === "sequence") return "Complete the previous lesson first";
  return "Available once you have access";
}
