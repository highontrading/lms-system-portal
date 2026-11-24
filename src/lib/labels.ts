import type {
  EnrollmentSource,
  LessonType,
  Level,
  LiveStatus,
  OrderStatus,
  PaymentGateway,
  ProductStatus,
  ProductType,
  ProductVisibility,
  ReviewStatus,
  SubmissionStatus,
  TicketPriority,
  TicketStatus,
} from "@/generated/prisma/enums";

export const PRODUCT_TYPES: ProductType[] = ["COURSE", "WORKSHOP", "AGENT", "WORKFLOW", "DIGITAL", "BUNDLE"];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  COURSE: "Course",
  WORKSHOP: "Workshop",
  AGENT: "AI Agent",
  WORKFLOW: "Workflow",
  DIGITAL: "Digital product",
  BUNDLE: "Bundle",
};

/** The type as it reads mid-sentence: "your AI agent is ready". */
export const PRODUCT_TYPE_NOUNS: Record<ProductType, string> = {
  COURSE: "course",
  WORKSHOP: "workshop",
  AGENT: "AI agent",
  WORKFLOW: "workflow",
  DIGITAL: "product",
  BUNDLE: "bundle",
};

export const PRODUCT_TYPE_PLURALS: Record<ProductType, string> = {
  COURSE: "Courses",
  WORKSHOP: "Workshops",
  AGENT: "AI Agents",
  WORKFLOW: "Workflows",
  DIGITAL: "Digital products",
  BUNDLE: "Bundles",
};

export const PRODUCT_TYPE_DESCRIPTIONS: Record<ProductType, string> = {
  COURSE: "Structured lessons with video, text, quizzes and a certificate.",
  WORKSHOP: "Live sessions with a schedule, join links, calendar invites and replays.",
  AGENT: "A ready-to-use AI agent with setup guide, files, links and version updates.",
  WORKFLOW: "An automation template with importable files, setup steps and updates.",
  DIGITAL: "Templates, e-books, prompt packs or any other downloadable product.",
  BUNDLE: "Several products sold together at one price.",
};

/** What the action of getting a product is called for each type. */
export const PRODUCT_TYPE_CTA: Record<ProductType, string> = {
  COURSE: "Enrol now",
  WORKSHOP: "Reserve my seat",
  AGENT: "Get this agent",
  WORKFLOW: "Get this workflow",
  DIGITAL: "Get access",
  BUNDLE: "Get the bundle",
};

export const PRODUCT_TYPE_SLUGS: Record<ProductType, string> = {
  COURSE: "course",
  WORKSHOP: "workshop",
  AGENT: "agent",
  WORKFLOW: "workflow",
  DIGITAL: "digital",
  BUNDLE: "bundle",
};

export function productTypeFromSlug(slug: string | null | undefined): ProductType | null {
  if (!slug) return null;
  const entry = Object.entries(PRODUCT_TYPE_SLUGS).find(([, value]) => value === slug.toLowerCase());
  return (entry?.[0] as ProductType | undefined) ?? null;
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const VISIBILITY_LABELS: Record<ProductVisibility, string> = {
  PUBLIC: "Public",
  UNLISTED: "Unlisted",
  PRIVATE: "Private",
};

export const VISIBILITY_DESCRIPTIONS: Record<ProductVisibility, string> = {
  PUBLIC: "Listed in the catalog and visible to everyone.",
  UNLISTED: "Hidden from the catalog; anyone with the link can view and buy.",
  PRIVATE: "No public page. Access is only granted by you, an import or the API.",
};

export const LEVEL_LABELS: Record<Level, string> = {
  ALL: "All levels",
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  VIDEO: "Video",
  TEXT: "Article",
  QUIZ: "Quiz",
  ASSIGNMENT: "Assignment",
  DOWNLOAD: "Download",
  EMBED: "Embed",
};

export const LESSON_TYPE_DESCRIPTIONS: Record<LessonType, string> = {
  VIDEO: "A video from YouTube, Vimeo, Bunny, an upload or any direct link.",
  TEXT: "A written lesson with rich formatting and images.",
  QUIZ: "Auto-graded questions with a pass mark.",
  ASSIGNMENT: "Students submit work for you to review.",
  DOWNLOAD: "Files, links and snippets to grab.",
  EMBED: "Any embeddable page: slides, Notion, Figma, Loom, a form.",
};

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  SCHEDULED: "Scheduled",
  LIVE: "Live now",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export const GATEWAY_LABELS: Record<PaymentGateway, string> = {
  RAZORPAY: "Razorpay",
  STRIPE: "Stripe",
  MANUAL: "Manual",
  EXTERNAL: "External platform",
  FREE: "Free",
};

export const ENROLLMENT_SOURCE_LABELS: Record<EnrollmentSource, string> = {
  PURCHASE: "Purchase",
  FREE: "Free enrolment",
  MANUAL: "Granted by admin",
  API: "API / integration",
  IMPORT: "CSV import",
  BUNDLE: "Via bundle",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  PENDING: "Awaiting approval",
  PUBLISHED: "Published",
  HIDDEN: "Hidden",
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: "Awaiting review",
  PASSED: "Passed",
  NEEDS_REVISION: "Needs revision",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  AWAITING_STUDENT: "Awaiting your reply",
  RESOLVED: "Resolved",
};

export const TICKET_STATUS_LABELS_STAFF: Record<TicketStatus, string> = {
  OPEN: "Needs reply",
  AWAITING_STUDENT: "Awaiting student",
  RESOLVED: "Resolved",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

/** Events that outgoing webhooks can subscribe to. */
export const WEBHOOK_EVENTS = [
  { id: "user.created", label: "Student account created" },
  { id: "enrollment.created", label: "Access granted" },
  { id: "enrollment.revoked", label: "Access revoked" },
  { id: "order.paid", label: "Order paid" },
  { id: "order.refunded", label: "Order refunded" },
  { id: "product.completed", label: "Student completed a product" },
  { id: "certificate.issued", label: "Certificate issued" },
  { id: "review.created", label: "Review submitted" },
  { id: "ticket.created", label: "Support ticket opened" },
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]["id"];
