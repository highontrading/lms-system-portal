import "server-only";
import path from "node:path";
import { can, isStaff } from "@/lib/permissions";
import type { SessionUser } from "@/server/auth/session";

/** What a file is being uploaded for. Decides who may upload, how big, and whether it is public. */
export type UploadPurpose = "media" | "private" | "avatar" | "submission";

const MB = 1024 * 1024;

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

// Types that could run script when opened from our own origin are never accepted.
const BLOCKED_EXTENSIONS = new Set([".html", ".htm", ".xhtml", ".shtml", ".js", ".mjs", ".php", ".exe", ".bat", ".cmd", ".sh", ".msi"]);

export type UploadRule = {
  visibility: "PUBLIC" | "PRIVATE";
  maxBytes: number;
  allow: (mimeType: string, extension: string) => boolean;
  describe: string;
};

const RULES: Record<UploadPurpose, UploadRule> = {
  // Thumbnails, logos, images inside lessons and pages.
  media: {
    visibility: "PUBLIC",
    maxBytes: 25 * MB,
    allow: (mime) => IMAGE_TYPES.includes(mime) || mime === "image/svg+xml" || mime === "application/pdf",
    describe: "Images (PNG, JPG, WebP, GIF, AVIF, SVG) or PDF up to 25 MB",
  },
  // Lesson videos and downloadable deliverables — only served to people with access.
  private: {
    visibility: "PRIVATE",
    maxBytes: 5 * 1024 * MB,
    allow: (_mime, extension) => !BLOCKED_EXTENSIONS.has(extension),
    describe: "Any file up to 5 GB",
  },
  avatar: {
    visibility: "PUBLIC",
    maxBytes: 5 * MB,
    allow: (mime) => IMAGE_TYPES.includes(mime),
    describe: "PNG, JPG, WebP or GIF up to 5 MB",
  },
  submission: {
    visibility: "PRIVATE",
    maxBytes: 50 * MB,
    allow: (_mime, extension) => !BLOCKED_EXTENSIONS.has(extension),
    describe: "Any file up to 50 MB",
  },
};

export function uploadRule(purpose: UploadPurpose) {
  return RULES[purpose];
}

export function isUploadPurpose(value: unknown): value is UploadPurpose {
  return typeof value === "string" && value in RULES;
}

export function canUpload(user: SessionUser, purpose: UploadPurpose) {
  if (purpose === "avatar" || purpose === "submission") return true;
  return isStaff(user.role) && (can(user.role, "media.manage") || can(user.role, "products.manage"));
}

/** Returns an error message when the file isn't acceptable for this purpose. */
export function validateUpload(purpose: UploadPurpose, file: { name: string; type: string; size: number }) {
  const rule = RULES[purpose];
  const extension = path.extname(file.name).toLowerCase();
  if (!file.name || file.name.length > 200) return "That file name is too long.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > rule.maxBytes) return `That file is too large. ${rule.describe}.`;
  if (!rule.allow(file.type, extension)) return `That file type isn't allowed here. ${rule.describe}.`;
  return null;
}

const INLINE_TYPES = /^(image\/(png|jpeg|webp|gif|avif|svg\+xml)|video\/|audio\/|application\/pdf$)/;

export function canDisplayInline(mimeType: string) {
  return INLINE_TYPES.test(mimeType);
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".json": "application/json",
  ".zip": "application/zip",
  ".csv": "text/csv",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

/** Browsers often send an empty type for less common files; fall back to the extension. */
export function resolveMimeType(fileName: string, reported: string | null | undefined) {
  if (reported && reported !== "application/octet-stream") return reported.split(";")[0].trim().toLowerCase();
  return MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? "application/octet-stream";
}
