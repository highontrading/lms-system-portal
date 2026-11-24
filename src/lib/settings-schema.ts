import { z } from "zod";

/**
 * Everything the owner can change from Admin → Settings.
 * Each section is stored as one JSON row; missing fields fall back to the defaults below,
 * so new settings can be added without a migration.
 */

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #5B4BF5");

const text = (max: number, fallback = "") => z.string().trim().max(max).default(fallback);
const link = () => z.string().trim().max(500).default("");

export const generalSchema = z.object({
  siteName: z.string().trim().min(1, "Give your academy a name").max(60).default("Ideabro Academy"),
  tagline: text(160, "Courses, workshops, AI agents and workflows — everything you buy lives here."),
  logoUrl: link(),
  logoDarkUrl: link(),
  faviconUrl: link(),
  supportEmail: text(200),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .length(3, "Use a 3-letter currency code such as INR or USD")
    .default("INR"),
  locale: text(20, "en-IN"),
  timezone: text(60, "Asia/Kolkata"),
  footerText: text(300, "Practical AI and automation skills you can put to work the same day."),
  social: z
    .object({
      website: link(),
      youtube: link(),
      instagram: link(),
      twitter: link(),
      linkedin: link(),
      telegram: link(),
      whatsapp: link(),
    })
    .prefault({}),
});

export const brandingSchema = z.object({
  brandColor: hexColor.default("#5B4BF5"),
  accentColor: hexColor.default("#FFC93C"),
  radius: z.enum(["sharp", "soft", "round"]).default("soft"),
  defaultTheme: z.enum(["light", "dark", "system"]).default("light"),
});

const linkItem = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(500),
});

export const navigationSchema = z.object({
  headerLinks: z
    .array(linkItem)
    .max(8)
    .default([
      { label: "Catalog", href: "/catalog" },
      { label: "Courses", href: "/catalog?type=course" },
      { label: "Workshops", href: "/catalog?type=workshop" },
      { label: "Agents & workflows", href: "/catalog?type=agent" },
    ]),
  footerLinks: z.array(linkItem).max(12).default([]),
});

const benefitItem = z.object({
  icon: z.string().trim().max(40).default("sparkles"),
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().max(300).default(""),
});

const statItem = z.object({
  value: z.string().trim().min(1).max(20),
  label: z.string().trim().min(1).max(40),
});

const testimonialItem = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().max(120).default(""),
  avatarUrl: link(),
  quote: z.string().trim().min(1).max(600),
});

const faqItem = z.object({
  q: z.string().trim().min(1).max(200),
  a: z.string().trim().min(1).max(2000),
});

export type FaqItem = z.infer<typeof faqItem>;

export const homeSchema = z.object({
  heroBadge: text(80, "Courses · Workshops · Agents · Workflows"),
  heroTitle: text(120, "Turn ideas into"),
  heroHighlight: text(60, "working AI systems"),
  heroSubtitle: text(
    400,
    "Learn practical AI and automation, join live workshops, and get ready-to-run agents and workflows. Everything you buy is waiting for you in one place.",
  ),
  heroPrimaryLabel: text(40, "Explore the catalog"),
  heroPrimaryHref: text(500, "/catalog"),
  heroSecondaryLabel: text(40, "Go to my learning"),
  heroSecondaryHref: text(500, "/dashboard"),
  heroImageUrl: link(),

  stats: z.array(statItem).max(4).default([]),

  showFeatured: z.boolean().default(true),
  featuredTitle: text(80, "Start with these"),
  featuredSubtitle: text(200, "Hand-picked programs and tools our learners use the most."),

  showTypes: z.boolean().default(true),

  showBenefits: z.boolean().default(true),
  benefitsTitle: text(80, "One home for everything you learn and use"),
  benefitsSubtitle: text(240, "Buy once, sign in, and pick up exactly where you left off — on any device."),
  benefits: z
    .array(benefitItem)
    .max(9)
    .default([
      {
        icon: "library",
        title: "Everything in one library",
        body: "Courses, workshop replays, agents and workflows you own, organised and searchable.",
      },
      {
        icon: "play",
        title: "Learn at your own pace",
        body: "Resume any lesson where you stopped, take notes as you go and track your progress.",
      },
      {
        icon: "video",
        title: "Live workshops and replays",
        body: "See session times in your own time zone, add them to your calendar and rewatch the replay any time.",
      },
      {
        icon: "bot",
        title: "Agents and workflows, ready to run",
        body: "Download the files, follow the setup guide and get notified when a new version ships.",
      },
      {
        icon: "award",
        title: "Certificates you can share",
        body: "Finish a program and get a verifiable certificate with its own public link.",
      },
      {
        icon: "shield",
        title: "Always the latest version",
        body: "When a file, agent or workflow is updated, the new version appears in your library automatically.",
      },
    ]),

  showTestimonials: z.boolean().default(true),
  testimonialsTitle: text(80, "What learners say"),
  testimonials: z.array(testimonialItem).max(12).default([]),

  showFaq: z.boolean().default(true),
  faqTitle: text(80, "Questions, answered"),
  faqs: z
    .array(faqItem)
    .max(20)
    .default([
      {
        q: "How do I access what I bought?",
        a: "Sign in with the email address you used at checkout. Everything you own appears in your library straight away.",
      },
      {
        q: "I paid but I can't see my purchase. What should I do?",
        a: "Check that you signed in with the same email you paid with. If it still isn't there, write to us and we'll sort it out.",
      },
      {
        q: "Can I learn on my phone?",
        a: "Yes. The whole portal works on phones, tablets and laptops, and your progress stays in sync between them.",
      },
      {
        q: "Do I get a certificate?",
        a: "Programs that offer a certificate issue one automatically when you complete them. Each certificate has a public verification link.",
      },
    ]),

  showCta: z.boolean().default(true),
  ctaTitle: text(100, "Ready to build something real?"),
  ctaSubtitle: text(240, "Pick a program, sign in and start today."),
  ctaLabel: text(40, "Browse the catalog"),
  ctaHref: text(500, "/catalog"),
});

export const authSchema = z.object({
  allowRegistration: z.boolean().default(true),
  requireEmailVerification: z.boolean().default(false),
  allowCodeLogin: z.boolean().default(true),
});

export const learningSchema = z.object({
  reviewsRequireApproval: z.boolean().default(false),
  discussionsEnabled: z.boolean().default(true),
  supportEnabled: z.boolean().default(true),
  showStreak: z.boolean().default(true),
});

export const certificateSchema = z.object({
  title: text(60, "Certificate of Completion"),
  intro: text(80, "This certifies that"),
  completionText: text(120, "has successfully completed"),
  signatureName: text(80),
  signatureTitle: text(80),
  signatureImageUrl: link(),
  style: z.enum(["classic", "modern"]).default("classic"),
});

export const emailSchema = z.object({
  provider: z.enum(["log", "smtp", "resend"]).default("log"),
  fromName: text(80),
  fromEmail: text(200),
  replyTo: text(200),
  smtpHost: text(200),
  smtpPort: z.coerce.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: text(200),
  /** Encrypted at rest. */
  smtpPassword: z.string().default(""),
  /** Encrypted at rest. */
  resendApiKey: z.string().default(""),
});

export const paymentsSchema = z.object({
  razorpayEnabled: z.boolean().default(false),
  razorpayKeyId: text(100),
  /** Encrypted at rest. */
  razorpayKeySecret: z.string().default(""),
  /** Encrypted at rest. */
  razorpayWebhookSecret: z.string().default(""),
  stripeEnabled: z.boolean().default(false),
  /** Encrypted at rest. */
  stripeSecretKey: z.string().default(""),
  /** Encrypted at rest. */
  stripeWebhookSecret: z.string().default(""),
  preferredGateway: z.enum(["razorpay", "stripe"]).default("razorpay"),
});

export const seoSchema = z.object({
  metaTitle: text(70),
  metaDescription: text(200),
  ogImageUrl: link(),
  googleAnalyticsId: z
    .string()
    .trim()
    .regex(/^(G-[A-Z0-9]{4,20})?$/, "Looks like G-XXXXXXXXXX")
    .default(""),
  metaPixelId: z
    .string()
    .trim()
    .regex(/^(\d{8,20})?$/, "Digits only")
    .default(""),
  allowIndexing: z.boolean().default(true),
});

export const invoiceSchema = z.object({
  businessName: text(120),
  businessAddress: text(400),
  taxId: text(60),
  taxLabel: text(20, "GSTIN"),
  orderPrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{0,10}$/, "Letters, numbers and dashes only")
    .default("IA-"),
  footerNote: text(300, "Thank you for learning with us."),
});

export const supportSchema = z.object({
  intro: text(300, "Search the answers below or open a ticket and we will get back to you."),
  responseTime: text(80, "We usually reply within one business day."),
  faqs: z.array(faqItem).max(30).default([]),
});

export const settingsSchemas = {
  general: generalSchema,
  branding: brandingSchema,
  navigation: navigationSchema,
  home: homeSchema,
  auth: authSchema,
  learning: learningSchema,
  certificate: certificateSchema,
  email: emailSchema,
  payments: paymentsSchema,
  seo: seoSchema,
  invoice: invoiceSchema,
  support: supportSchema,
} as const;

export type SettingsSection = keyof typeof settingsSchemas;

export type Settings = {
  [K in SettingsSection]: z.infer<(typeof settingsSchemas)[K]>;
};

export const SETTINGS_SECTIONS = Object.keys(settingsSchemas) as SettingsSection[];

/** Fields that hold credentials. They are encrypted before saving and never sent back to the browser. */
export const SECRET_FIELDS: { [K in SettingsSection]?: (keyof Settings[K])[] } = {
  email: ["smtpPassword", "resendApiKey"],
  payments: ["razorpayKeySecret", "razorpayWebhookSecret", "stripeSecretKey", "stripeWebhookSecret"],
};

export function defaultSettings(): Settings {
  const out = {} as Record<string, unknown>;
  for (const key of SETTINGS_SECTIONS) out[key] = settingsSchemas[key].parse({});
  return out as Settings;
}
