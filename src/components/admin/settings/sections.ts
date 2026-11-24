import type { SettingsSection } from "@/lib/settings-schema";

/** Declarative description of every settings screen. Rendered by <SettingsForm>. */

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "url"
  | "number"
  | "switch"
  | "select"
  | "color"
  | "image"
  | "secret"
  | "repeater";

export type Condition = { key: string; equals: string | boolean };

export type FieldSpec = {
  /** Dot path inside the section (or inside a repeater item). */
  key: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  rows?: number;
  options?: { value: string; label: string }[];
  /** Repeater only: the fields of one item, the label for "add", and the item limit. */
  fields?: FieldSpec[];
  addLabel?: string;
  max?: number;
  /** Image only. */
  purpose?: "media" | "avatar";
  /** Render two short fields side by side on wider screens. */
  half?: boolean;
  showWhen?: Condition;
};

export type GroupSpec = {
  title: string;
  description?: string;
  fields: FieldSpec[];
  showWhen?: Condition;
};

export type SectionSpec = {
  id: SettingsSection;
  label: string;
  description: string;
  icon: string;
  groups: GroupSpec[];
};

/** Icon names the home page understands for "benefit" cards. */
export const BENEFIT_ICONS = [
  "sparkles",
  "library",
  "play",
  "video",
  "bot",
  "workflow",
  "award",
  "message",
  "zap",
  "clock",
  "users",
  "shield",
  "rocket",
  "download",
  "calendar",
  "star",
];

const faqFields: FieldSpec[] = [
  { key: "q", label: "Question", type: "text" },
  { key: "a", label: "Answer", type: "textarea", rows: 3 },
];

const linkFields: FieldSpec[] = [
  { key: "label", label: "Label", type: "text", half: true, placeholder: "Catalog" },
  { key: "href", label: "Link", type: "text", half: true, placeholder: "/catalog or https://…" },
];

export const SECTION_SPECS: SectionSpec[] = [
  {
    id: "general",
    label: "General",
    description: "Your academy's name, logo, contact details and regional formats.",
    icon: "settings",
    groups: [
      {
        title: "Identity",
        fields: [
          { key: "siteName", label: "Academy name", type: "text" },
          { key: "tagline", label: "Tagline", type: "textarea", rows: 2, hint: "One sentence about what you offer. Used on the sign-in screen and as the default page description." },
          { key: "logoUrl", label: "Logo", type: "image", hint: "Shown in headers and emails. A wide PNG or SVG with a transparent background works best. Leave empty to use the name." },
          { key: "logoDarkUrl", label: "Logo for dark backgrounds", type: "image", hint: "Optional. Used in dark mode." },
          { key: "faviconUrl", label: "Browser icon", type: "image", hint: "Optional square icon for the browser tab." },
        ],
      },
      {
        title: "Contact and region",
        fields: [
          { key: "supportEmail", label: "Support email", type: "email", placeholder: "help@yourdomain.com", hint: "Shown to students and used as the reply-to address on emails." },
          { key: "locale", label: "Locale", type: "text", half: true, placeholder: "en-IN", hint: "How dates and numbers are written, e.g. en-IN or en-US." },
          { key: "timezone", label: "Time zone", type: "text", half: true, placeholder: "Asia/Kolkata", hint: "Used when you schedule live sessions and in emails." },
        ],
      },
      {
        title: "Footer",
        fields: [{ key: "footerText", label: "Footer text", type: "textarea", rows: 2 }],
      },
      {
        title: "Social links",
        description: "Shown in the site footer. Leave any of them empty to hide it.",
        fields: [
          { key: "social.website", label: "Website", type: "url", half: true },
          { key: "social.youtube", label: "YouTube", type: "url", half: true },
          { key: "social.instagram", label: "Instagram", type: "url", half: true },
          { key: "social.twitter", label: "X (Twitter)", type: "url", half: true },
          { key: "social.linkedin", label: "LinkedIn", type: "url", half: true },
          { key: "social.telegram", label: "Telegram", type: "url", half: true },
          { key: "social.whatsapp", label: "WhatsApp", type: "url", half: true },
        ],
      },
    ],
  },
  {
    id: "branding",
    label: "Branding",
    description: "Colours, corner style and the default theme for the whole portal.",
    icon: "palette",
    groups: [
      {
        title: "Colours",
        description: "Buttons, links, progress bars and highlights all follow these two colours.",
        fields: [
          { key: "brandColor", label: "Brand colour", type: "color", half: true, hint: "Main colour for buttons and links." },
          { key: "accentColor", label: "Accent colour", type: "color", half: true, hint: "Used sparingly for highlights and badges." },
        ],
      },
      {
        title: "Style",
        fields: [
          {
            key: "radius",
            label: "Corners",
            type: "select",
            half: true,
            options: [
              { value: "sharp", label: "Sharp" },
              { value: "soft", label: "Soft" },
              { value: "round", label: "Round" },
            ],
          },
          {
            key: "defaultTheme",
            label: "Default theme",
            type: "select",
            half: true,
            hint: "Visitors can still switch for themselves.",
            options: [
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Match the visitor's device" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "home",
    label: "Home page",
    description: "Everything on the public landing page.",
    icon: "home",
    groups: [
      {
        title: "Hero",
        fields: [
          { key: "heroBadge", label: "Small label above the title", type: "text" },
          { key: "heroTitle", label: "Title", type: "text", half: true },
          { key: "heroHighlight", label: "Highlighted words", type: "text", half: true, hint: "Shown right after the title in your accent colour." },
          { key: "heroSubtitle", label: "Subtitle", type: "textarea", rows: 3 },
          { key: "heroPrimaryLabel", label: "Main button label", type: "text", half: true },
          { key: "heroPrimaryHref", label: "Main button link", type: "text", half: true },
          { key: "heroSecondaryLabel", label: "Second button label", type: "text", half: true },
          { key: "heroSecondaryHref", label: "Second button link", type: "text", half: true },
          { key: "heroImageUrl", label: "Hero image", type: "image", hint: "Optional." },
        ],
      },
      {
        title: "Numbers",
        description: "Optional figures shown under the hero, such as “2,400+ learners”. Leave empty to hide the strip.",
        fields: [
          {
            key: "stats",
            label: "Numbers",
            type: "repeater",
            addLabel: "Add a number",
            max: 4,
            fields: [
              { key: "value", label: "Number", type: "text", half: true, placeholder: "2,400+" },
              { key: "label", label: "Label", type: "text", half: true, placeholder: "Learners" },
            ],
          },
        ],
      },
      {
        title: "Featured products",
        fields: [
          { key: "showFeatured", label: "Show featured products", type: "switch", hint: "Products marked as featured appear here." },
          { key: "featuredTitle", label: "Heading", type: "text", showWhen: { key: "showFeatured", equals: true } },
          { key: "featuredSubtitle", label: "Sub-heading", type: "text", showWhen: { key: "showFeatured", equals: true } },
        ],
      },
      {
        title: "Product types",
        fields: [{ key: "showTypes", label: "Show the “browse by type” strip", type: "switch", hint: "Courses, workshops, agents, workflows…" }],
      },
      {
        title: "Benefits",
        fields: [
          { key: "showBenefits", label: "Show benefits", type: "switch" },
          { key: "benefitsTitle", label: "Heading", type: "text", showWhen: { key: "showBenefits", equals: true } },
          { key: "benefitsSubtitle", label: "Sub-heading", type: "text", showWhen: { key: "showBenefits", equals: true } },
          {
            key: "benefits",
            label: "Benefit cards",
            type: "repeater",
            addLabel: "Add a benefit",
            max: 9,
            showWhen: { key: "showBenefits", equals: true },
            fields: [
              { key: "icon", label: "Icon", type: "select", half: true, options: BENEFIT_ICONS.map((name) => ({ value: name, label: name.charAt(0).toUpperCase() + name.slice(1) })) },
              { key: "title", label: "Title", type: "text", half: true },
              { key: "body", label: "Text", type: "textarea", rows: 2 },
            ],
          },
        ],
      },
      {
        title: "Testimonials",
        description: "Only add real quotes from real learners. The section stays hidden while the list is empty.",
        fields: [
          { key: "showTestimonials", label: "Show testimonials", type: "switch" },
          { key: "testimonialsTitle", label: "Heading", type: "text", showWhen: { key: "showTestimonials", equals: true } },
          {
            key: "testimonials",
            label: "Testimonials",
            type: "repeater",
            addLabel: "Add a testimonial",
            max: 12,
            showWhen: { key: "showTestimonials", equals: true },
            fields: [
              { key: "name", label: "Name", type: "text", half: true },
              { key: "role", label: "Role or company", type: "text", half: true },
              { key: "quote", label: "Quote", type: "textarea", rows: 3 },
              { key: "avatarUrl", label: "Photo", type: "image", purpose: "avatar", hint: "Optional." },
            ],
          },
        ],
      },
      {
        title: "Questions and answers",
        fields: [
          { key: "showFaq", label: "Show the FAQ", type: "switch" },
          { key: "faqTitle", label: "Heading", type: "text", showWhen: { key: "showFaq", equals: true } },
          { key: "faqs", label: "Questions", type: "repeater", addLabel: "Add a question", max: 20, fields: faqFields, showWhen: { key: "showFaq", equals: true } },
        ],
      },
      {
        title: "Closing call to action",
        fields: [
          { key: "showCta", label: "Show the closing banner", type: "switch" },
          { key: "ctaTitle", label: "Heading", type: "text", showWhen: { key: "showCta", equals: true } },
          { key: "ctaSubtitle", label: "Sub-heading", type: "text", showWhen: { key: "showCta", equals: true } },
          { key: "ctaLabel", label: "Button label", type: "text", half: true, showWhen: { key: "showCta", equals: true } },
          { key: "ctaHref", label: "Button link", type: "text", half: true, showWhen: { key: "showCta", equals: true } },
        ],
      },
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Links in the public site header and footer.",
    icon: "menu",
    groups: [
      {
        title: "Header links",
        description: "Shown at the top of the public site. Use a path such as /catalog or a full web address.",
        fields: [{ key: "headerLinks", label: "Header links", type: "repeater", addLabel: "Add a link", max: 8, fields: linkFields }],
      },
      {
        title: "Footer links",
        description: "Extra links for the footer. Published pages marked “show in footer” are added automatically.",
        fields: [{ key: "footerLinks", label: "Footer links", type: "repeater", addLabel: "Add a link", max: 12, fields: linkFields }],
      },
    ],
  },
  {
    id: "auth",
    label: "Sign-in",
    description: "Who can create an account and how people sign in.",
    icon: "key",
    groups: [
      {
        title: "Accounts",
        fields: [
          { key: "allowRegistration", label: "Let anyone create an account", type: "switch", hint: "Turn off if accounts should only be created when you grant access (by hand, by import or through the API)." },
          { key: "requireEmailVerification", label: "Require a confirmed email before signing in", type: "switch", hint: "People who sign up themselves must click the link we email them first." },
          { key: "allowCodeLogin", label: "Allow sign-in with an emailed code", type: "switch", hint: "Recommended: buyers can get in with just their email address, without setting a password. Needs working email." },
        ],
      },
    ],
  },
  {
    id: "learning",
    label: "Learning",
    description: "Options for the student portal.",
    icon: "graduation",
    groups: [
      {
        title: "Motivation",
        fields: [{ key: "showStreak", label: "Show learning streaks", type: "switch", hint: "Students see how many days in a row they have learned." }],
      },
    ],
  },
  {
    id: "certificate",
    label: "Certificates",
    description: "Wording and signature on completion certificates.",
    icon: "award",
    groups: [
      {
        title: "Wording",
        fields: [
          { key: "title", label: "Certificate title", type: "text" },
          { key: "intro", label: "Line before the student's name", type: "text", half: true },
          { key: "completionText", label: "Line before the product name", type: "text", half: true },
        ],
      },
      {
        title: "Signature",
        fields: [
          { key: "signatureName", label: "Name", type: "text", half: true },
          { key: "signatureTitle", label: "Title", type: "text", half: true, placeholder: "Founder" },
          { key: "signatureImageUrl", label: "Signature image", type: "image", hint: "Optional. A transparent PNG of a handwritten signature." },
        ],
      },
      {
        title: "Design",
        fields: [
          {
            key: "style",
            label: "Style",
            type: "select",
            half: true,
            options: [
              { value: "classic", label: "Classic" },
              { value: "modern", label: "Modern" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "email",
    label: "Email",
    description: "How the academy sends sign-in codes, access emails and announcements.",
    icon: "mail",
    groups: [
      {
        title: "Provider",
        description: "Until a provider is set up, emails are only written to the email log — nothing reaches students.",
        fields: [
          {
            key: "provider",
            label: "Send email with",
            type: "select",
            options: [
              { value: "log", label: "Not set up — log only" },
              { value: "smtp", label: "SMTP (any mail server)" },
              { value: "resend", label: "Resend" },
            ],
          },
        ],
      },
      {
        title: "Sender",
        fields: [
          { key: "fromName", label: "From name", type: "text", half: true, placeholder: "Ideabro Academy" },
          { key: "fromEmail", label: "From address", type: "email", half: true, placeholder: "hello@yourdomain.com" },
          { key: "replyTo", label: "Reply-to address", type: "email", hint: "Optional. Defaults to your support email." },
        ],
      },
      {
        title: "SMTP server",
        showWhen: { key: "provider", equals: "smtp" },
        fields: [
          { key: "smtpHost", label: "Host", type: "text", half: true, placeholder: "smtp.yourprovider.com" },
          { key: "smtpPort", label: "Port", type: "number", half: true, placeholder: "587" },
          { key: "smtpSecure", label: "Use implicit TLS", type: "switch", hint: "On for port 465. Leave off for 587." },
          { key: "smtpUser", label: "Username", type: "text", half: true },
          { key: "smtpPassword", label: "Password", type: "secret", half: true },
        ],
      },
      {
        title: "Resend",
        showWhen: { key: "provider", equals: "resend" },
        fields: [{ key: "resendApiKey", label: "API key", type: "secret", hint: "Create one at resend.com → API keys. The from address must be on a domain you verified there." }],
      },
    ],
  },
  {
    id: "seo",
    label: "Search & analytics",
    description: "How the site appears in search results and when shared, plus tracking IDs.",
    icon: "search",
    groups: [
      {
        title: "Search and sharing",
        fields: [
          { key: "metaTitle", label: "Site title", type: "text", hint: "Defaults to the academy name." },
          { key: "metaDescription", label: "Description", type: "textarea", rows: 2, hint: "Defaults to the tagline." },
          { key: "ogImageUrl", label: "Share image", type: "image", hint: "Shown when a link is shared. 1200×630 works best." },
          { key: "allowIndexing", label: "Let search engines index the site", type: "switch" },
        ],
      },
      {
        title: "Analytics",
        fields: [
          { key: "googleAnalyticsId", label: "Google Analytics measurement ID", type: "text", half: true, placeholder: "G-XXXXXXXXXX" },
          { key: "metaPixelId", label: "Meta Pixel ID", type: "text", half: true, placeholder: "123456789012345" },
        ],
      },
    ],
  },
  {
    id: "support",
    label: "Help",
    description: "What students see when they look for help.",
    icon: "help",
    groups: [
      {
        title: "Help page",
        fields: [
          { key: "intro", label: "Introduction", type: "textarea", rows: 2 },
          { key: "responseTime", label: "Response time note", type: "text" },
          { key: "faqs", label: "Common questions", type: "repeater", addLabel: "Add a question", max: 30, fields: faqFields },
        ],
      },
    ],
  },
];

export const EDITABLE_SECTION_IDS = SECTION_SPECS.map((section) => section.id);

export function findSection(id: string) {
  return SECTION_SPECS.find((section) => section.id === id) ?? null;
}
