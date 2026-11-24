/**
 * Seeds the database: the owner account, starter pages and (unless SEED_DEMO=false) a set of
 * sample products and students so the portal isn't empty on first run.
 *
 *   npm run db:seed
 *
 * Safe to run more than once. Sample content is tagged (SKUs starting "DEMO-", students at
 * @example.com) and can be removed from Admin → Dashboard → "Remove sample content".
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { LessonType, ProductType } from "../src/generated/prisma/enums";
import { progressPercent } from "../src/lib/curriculum";
import { hashPassword } from "../src/server/auth/password";
import { generateLicenseKey, randomReadable } from "../src/server/crypto";
import { buildStorageKey, putObject } from "../src/server/storage";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const daysAgo = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 60 * 60 * 1000);
/** A future (or past) day at 7:30 pm India time. */
function eveningIn(days: number) {
  const date = new Date(now.getTime() + days * DAY);
  date.setUTCHours(14, 0, 0, 0);
  return date;
}

const SAMPLE_VIDEO = "/demo/sample-lesson.mp4";

// ───────────────────────────── Owner account ─────────────────────────────

async function seedOwner() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@ideabro.academy").toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "OWNER") await db.user.update({ where: { id: existing.id }, data: { role: "OWNER" } });
    console.log(`✓ Owner account already exists: ${email}`);
    return existing;
  }
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const owner = await db.user.create({
    data: {
      email,
      name: process.env.SEED_ADMIN_NAME || "Academy Owner",
      role: "OWNER",
      passwordHash: await hashPassword(password),
      emailVerifiedAt: now,
    },
  });
  console.log(`✓ Owner account created: ${email}`);
  if (generated) console.log(`  Password (shown once — change it after signing in): ${password}`);
  return owner;
}

// ───────────────────────────── Starter pages ─────────────────────────────

const PAGE_NOTE =
  "<p><em>This is a starter page. Edit it in Admin → Pages before you launch.</em></p>";

async function seedPages() {
  const pages = [
    {
      slug: "about",
      title: "About us",
      position: 0,
      body: `${PAGE_NOTE}<h2>Why we exist</h2><p>We teach practical AI and automation skills and give you the tools to put them to work: courses, live workshops, ready-to-run agents and workflow templates.</p><h2>How it works</h2><p>Everything you get from us lives in your library. Sign in with the email address you purchased with and it is all there, on any device.</p>`,
    },
    {
      slug: "terms",
      title: "Terms of use",
      position: 1,
      body: `${PAGE_NOTE}<h2>Your account</h2><p>Your access is personal to you. Please don't share your sign-in details or redistribute the materials.</p><h2>Using the materials</h2><p>You may use templates, agents and workflows in your own work and for your own clients. You may not resell them as-is.</p>`,
    },
    {
      slug: "privacy",
      title: "Privacy policy",
      position: 2,
      body: `${PAGE_NOTE}<h2>What we collect</h2><p>Your name, email address and learning progress, so we can give you access to what you bought and remember where you left off.</p><h2>How to reach us</h2><p>Write to the support address shown in the footer for any privacy request.</p>`,
    },
  ];
  for (const page of pages) {
    await db.page.upsert({ where: { slug: page.slug }, update: {}, create: page });
  }
  console.log("✓ Starter pages");
}

// ───────────────────────────── Sample content ─────────────────────────────

type LessonSeed = {
  title: string;
  type: LessonType;
  minutes?: number;
  preview?: boolean;
  content?: string;
  embedUrl?: string;
  quiz?: {
    passPercent: number;
    questions: { prompt: string; type?: "SINGLE" | "MULTIPLE" | "TRUE_FALSE"; options: [string, boolean][]; explanation?: string }[];
  };
  assets?: AssetSeed[];
};

type AssetSeed =
  | { kind: "LINK"; title: string; description?: string; url: string }
  | { kind: "SNIPPET"; title: string; description?: string; content: string; language?: string }
  | { kind: "FILE"; title: string; description?: string; fileName: string; mimeType: string; body: string; version?: string };

type SectionSeed = { title: string; description?: string; dripDays?: number; lessons: LessonSeed[] };

async function createAsset(productId: string, lessonId: string | null, asset: AssetSeed, position: number) {
  if (asset.kind === "FILE") {
    const key = buildStorageKey(asset.fileName, "PRIVATE");
    const buffer = Buffer.from(asset.body, "utf8");
    await putObject(key, buffer, asset.mimeType);
    await db.media.create({
      data: { key, fileName: asset.fileName, mimeType: asset.mimeType, size: buffer.length, visibility: "PRIVATE" },
    });
    return db.asset.create({
      data: {
        productId,
        lessonId,
        kind: "FILE",
        title: asset.title,
        description: asset.description,
        fileKey: key,
        fileName: asset.fileName,
        fileSize: buffer.length,
        mimeType: asset.mimeType,
        version: asset.version,
        position,
      },
    });
  }
  if (asset.kind === "LINK") {
    return db.asset.create({
      data: { productId, lessonId, kind: "LINK", title: asset.title, description: asset.description, url: asset.url, position },
    });
  }
  return db.asset.create({
    data: {
      productId,
      lessonId,
      kind: "SNIPPET",
      title: asset.title,
      description: asset.description,
      content: asset.content,
      language: asset.language,
      position,
    },
  });
}

async function createCurriculum(productId: string, sections: SectionSeed[]) {
  const lessonIds: string[] = [];
  for (const [sectionIndex, section] of sections.entries()) {
    const created = await db.section.create({
      data: {
        productId,
        title: section.title,
        description: section.description,
        dripDays: section.dripDays ?? null,
        position: sectionIndex,
      },
    });
    for (const [lessonIndex, lesson] of section.lessons.entries()) {
      const row = await db.lesson.create({
        data: {
          productId,
          sectionId: created.id,
          title: lesson.title,
          type: lesson.type,
          position: lessonIndex,
          isPreview: lesson.preview ?? false,
          durationSeconds: lesson.minutes ? lesson.minutes * 60 : null,
          content: lesson.content ?? null,
          embedUrl: lesson.embedUrl ?? null,
          ...(lesson.type === "VIDEO" ? { videoProvider: "URL" as const, videoUrl: SAMPLE_VIDEO } : {}),
        },
      });
      lessonIds.push(row.id);
      if (lesson.quiz) {
        await db.quiz.create({
          data: {
            lessonId: row.id,
            passPercent: lesson.quiz.passPercent,
            questions: {
              create: lesson.quiz.questions.map((question, position) => ({
                type: question.type ?? "SINGLE",
                prompt: question.prompt,
                explanation: question.explanation,
                position,
                options: question.options.map(([text, correct], index) => ({ id: `o${index + 1}`, text, correct })),
              })),
            },
          },
        });
      }
      for (const [assetIndex, asset] of (lesson.assets ?? []).entries()) {
        await createAsset(productId, row.id, asset, assetIndex);
      }
    }
  }
  return lessonIds;
}

const WORKFLOW_JSON = (name: string) =>
  JSON.stringify(
    {
      name,
      nodes: [
        { name: "Trigger", type: "n8n-nodes-base.webhook", parameters: { path: "incoming" } },
        { name: "Classify", type: "n8n-nodes-base.openAi", parameters: { model: "gpt-4o-mini" } },
        { name: "Route", type: "n8n-nodes-base.switch", parameters: {} },
      ],
      connections: { Trigger: { main: [[{ node: "Classify" }]] }, Classify: { main: [[{ node: "Route" }]] } },
      note: "Sample file from the demo content. Replace it with your real export.",
    },
    null,
    2,
  );

async function seedDemo() {
  if (await db.product.findFirst({ where: { sku: { startsWith: "DEMO-" } } })) {
    console.log("✓ Sample content already present (skipped)");
    return;
  }

  const [catAi, catNoCode] = await Promise.all([
    db.category.upsert({
      where: { slug: "ai-automation" },
      update: {},
      create: { name: "AI & Automation", slug: "ai-automation", position: 0 },
    }),
    db.category.upsert({
      where: { slug: "no-code-tools" },
      update: {},
      create: { name: "No-code tools", slug: "no-code-tools", position: 1 },
    }),
  ]);

  const instructor = await db.instructor.upsert({
    where: { slug: "ideabro-team" },
    update: {},
    create: {
      name: "Ideabro Team",
      slug: "ideabro-team",
      title: "Automation educators",
      bio: "We build AI agents and automations for a living, and teach what actually works.",
    },
  });

  const base = { status: "PUBLISHED" as const, publishedAt: daysAgo(60), instructors: { connect: { id: instructor.id } } };

  // ── Course ────────────────────────────────────────────────────────────────
  const course = await db.product.create({
    data: {
      ...base,
      type: "COURSE",
      sku: "DEMO-COURSE",
      title: "AI Automation Foundations",
      slug: "ai-automation-foundations",
      tagline: "Go from zero to shipping your first AI-powered automations.",
      description:
        "<p>A hands-on course for people who want AI to do real work, not just chat. You'll learn how automations are put together, build three of them step by step, and add AI where it genuinely helps.</p><p>Every lesson ends with something you can run. By the end you'll have a small library of automations you understand well enough to change.</p>",
      categoryId: catAi.id,
      level: "BEGINNER",
      durationLabel: "4 hours · self-paced",
      tags: ["AI", "Automation", "n8n"],
      price: 499900,
      compareAtPrice: 999900,
      outcomes: [
        "Explain triggers, actions and data mapping in plain words",
        "Build and debug an automation from a blank canvas",
        "Write prompts that return reliable, structured output",
        "Add monitoring so you know when something breaks",
      ],
      requirements: ["A laptop and a free n8n or Make account", "No coding experience needed"],
      audience: ["Founders and freelancers who want to save hours every week", "Operations and marketing people curious about AI"],
      faqs: [
        { q: "How long do I have access?", a: "For as long as the academy exists — there's no expiry on this course." },
        { q: "Do I get a certificate?", a: "Yes. Finish every lesson and your certificate is issued automatically." },
      ],
      certificateEnabled: true,
      featured: true,
      position: 0,
    },
  });

  const courseLessons = await createCurriculum(course.id, [
    {
      title: "Getting started",
      lessons: [
        {
          title: "Welcome, and how this course works",
          type: "VIDEO",
          minutes: 4,
          preview: true,
          content: "<p>A quick tour of what you'll build and how to get the most from each lesson.</p>",
        },
        {
          title: "What automation can (and can't) do",
          type: "TEXT",
          minutes: 6,
          content:
            "<h2>Start with the boring tasks</h2><p>The best first automations are small, frequent and rule-based: copying form entries into a sheet, sending a follow-up, filing an attachment.</p><ul><li><strong>Good fit:</strong> the steps are the same every time.</li><li><strong>Poor fit:</strong> the task needs judgement you can't describe.</li></ul><blockquote>If you can explain the task to a new teammate in five sentences, you can probably automate it.</blockquote><h2>Where AI helps</h2><p>AI is useful for the fuzzy middle: reading messy text, classifying, summarising and drafting. Everything around it should stay predictable.</p>",
        },
        {
          title: "Set up your workspace",
          type: "VIDEO",
          minutes: 9,
          assets: [{ kind: "LINK", title: "n8n — create a free account", url: "https://n8n.io" }],
        },
      ],
    },
    {
      title: "Your first automation",
      lessons: [
        { title: "Triggers, actions and data", type: "VIDEO", minutes: 12 },
        {
          title: "Build: form → sheet → email",
          type: "VIDEO",
          minutes: 18,
          assets: [
            {
              kind: "SNIPPET",
              title: "Sample form payload",
              description: "Paste this into the webhook test panel.",
              language: "json",
              content: JSON.stringify({ name: "Asha Verma", email: "asha@example.com", interest: "Automation audit" }, null, 2),
            },
          ],
        },
        {
          title: "Check your understanding",
          type: "QUIZ",
          minutes: 5,
          quiz: {
            passPercent: 70,
            questions: [
              {
                prompt: "What starts an automation running?",
                options: [
                  ["A trigger", true],
                  ["An action", false],
                  ["A variable", false],
                ],
                explanation: "A trigger is the event that kicks things off — a new form entry, a schedule, an incoming email.",
              },
              {
                prompt: "Which tasks are a good first automation? Select all that apply.",
                type: "MULTIPLE",
                options: [
                  ["Copying form entries into a spreadsheet", true],
                  ["Sending a templated follow-up email", true],
                  ["Negotiating a contract", false],
                ],
              },
              {
                prompt: "True or false: you should test with real sample data before switching an automation on.",
                type: "TRUE_FALSE",
                options: [
                  ["True", true],
                  ["False", false],
                ],
              },
            ],
          },
        },
      ],
    },
    {
      title: "Adding AI",
      lessons: [
        {
          title: "Prompting for reliable output",
          type: "TEXT",
          minutes: 8,
          content:
            "<h2>Ask for a shape, not an essay</h2><p>Automations need output they can parse. Tell the model exactly what to return:</p><pre><code>Classify the email below.\nReturn JSON only: { \"category\": \"sales\" | \"support\" | \"other\", \"urgent\": true | false }</code></pre><p>Then test with ten real examples and note every case it gets wrong before you trust it.</p>",
        },
        { title: "Build: an AI email triage flow", type: "VIDEO", minutes: 22 },
        {
          title: "Templates and cheat sheet",
          type: "DOWNLOAD",
          content: "<p>Everything from this module in one place.</p>",
          assets: [
            {
              kind: "FILE",
              title: "Email triage workflow",
              fileName: "email-triage-workflow.json",
              mimeType: "application/json",
              body: WORKFLOW_JSON("Email triage"),
            },
            {
              kind: "FILE",
              title: "Prompt cheat sheet",
              fileName: "prompt-cheat-sheet.md",
              mimeType: "text/markdown",
              body: "# Prompt cheat sheet\n\n1. State the role.\n2. Give the input.\n3. Specify the exact output shape.\n4. Add two examples.\n",
            },
          ],
        },
      ],
    },
    {
      title: "Bonus: going further",
      description: "Unlocks one week after you join.",
      dripDays: 7,
      lessons: [
        { title: "Monitoring and error handling", type: "VIDEO", minutes: 14 },
        {
          title: "Where to go next",
          type: "TEXT",
          minutes: 3,
          content: "<p>Pick one process you run every week and automate it end to end. Then join a live workshop to build an agent with us.</p>",
        },
      ],
    },
  ]);

  // ── Workshop ──────────────────────────────────────────────────────────────
  const workshop = await db.product.create({
    data: {
      ...base,
      type: "WORKSHOP",
      sku: "DEMO-WORKSHOP",
      title: "Build an AI Support Agent — Live",
      slug: "ai-support-agent-live",
      tagline: "Two live evenings. One working support agent you take home.",
      description:
        "<p>Build a support agent alongside us, live. We design it together in session one and ship it in session two. Replays are added here within a day.</p>",
      categoryId: catAi.id,
      level: "INTERMEDIATE",
      durationLabel: "2 live sessions · 90 min each",
      tags: ["Live", "Agents"],
      price: 149900,
      seatLimit: 100,
      outcomes: ["A support agent that answers from your own documents", "A checklist for testing agents before launch"],
      featured: true,
      position: 1,
    },
  });
  await db.liveSession.createMany({
    data: [
      {
        productId: workshop.id,
        title: "Kick-off and setup",
        description: "Accounts, tools and a walkthrough of what we'll build.",
        startsAt: eveningIn(-4),
        durationMinutes: 45,
        platform: "Zoom",
        status: "ENDED",
        recordingProvider: "URL",
        recordingUrl: SAMPLE_VIDEO,
      },
      {
        productId: workshop.id,
        title: "Session 1 — Design the agent",
        description: "Scope, knowledge sources and guardrails.",
        startsAt: eveningIn(3),
        durationMinutes: 90,
        platform: "Zoom",
        meetingUrl: "https://example.com/live/session-1",
        meetingPasscode: "IDEA24",
      },
      {
        productId: workshop.id,
        title: "Session 2 — Build and deploy",
        description: "Wire it up, test it and put it live.",
        startsAt: eveningIn(5),
        durationMinutes: 90,
        platform: "Zoom",
        meetingUrl: "https://example.com/live/session-2",
        meetingPasscode: "IDEA24",
      },
    ],
  });
  await createCurriculum(workshop.id, [
    {
      title: "Workshop materials",
      lessons: [
        {
          title: "Before the workshop: checklist",
          type: "TEXT",
          minutes: 3,
          content: "<ul><li>Create your n8n account</li><li>Collect 5–10 real support questions</li><li>Have your help docs handy as a PDF or link</li></ul>",
        },
      ],
    },
  ]);
  await createAsset(workshop.id, null, { kind: "LINK", title: "Workshop slides", description: "View-only deck", url: "https://example.com/slides" }, 0);

  // ── Agent ─────────────────────────────────────────────────────────────────
  const agent = await db.product.create({
    data: {
      ...base,
      type: "AGENT",
      sku: "DEMO-AGENT",
      title: "Inbox Triage Agent",
      slug: "inbox-triage-agent",
      tagline: "Sorts, labels and drafts replies for your inbox — ready to import.",
      description:
        "<p>An agent that reads incoming email, labels it, flags what's urgent and drafts a reply for anything routine. Import the file, connect your accounts and it's running in about 20 minutes.</p>",
      categoryId: catAi.id,
      durationLabel: "20-minute setup",
      tags: ["Agent", "Email", "n8n"],
      price: 249900,
      version: "1.2.0",
      platform: "n8n · OpenAI",
      licenseKeysEnabled: true,
      outcomes: ["Importable agent file", "System prompt you can adapt", "Setup guide and updates"],
      position: 2,
    },
  });
  await createCurriculum(agent.id, [
    {
      title: "Setup guide",
      lessons: [
        {
          title: "1. What you get",
          type: "TEXT",
          minutes: 2,
          content: "<p>The agent file, the system prompt and a configuration sheet. Grab them from <strong>Files &amp; links</strong>.</p>",
        },
        {
          title: "2. Connect your accounts",
          type: "TEXT",
          minutes: 5,
          content: "<ol><li>Add your email credential.</li><li>Add your OpenAI key.</li><li>Run the connection test node.</li></ol>",
        },
        { title: "3. Import and configure", type: "VIDEO", minutes: 8 },
        {
          title: "4. Test and go live",
          type: "TEXT",
          minutes: 4,
          content: "<p>Send yourself three test emails — one urgent, one routine, one spam — and check the labels before switching the agent on.</p>",
        },
      ],
    },
  ]);
  const agentAssets: AssetSeed[] = [
    {
      kind: "FILE",
      title: "Inbox Triage Agent",
      description: "Import this file into n8n.",
      fileName: "inbox-triage-agent-v1.2.0.json",
      mimeType: "application/json",
      body: WORKFLOW_JSON("Inbox Triage Agent"),
      version: "1.2.0",
    },
    {
      kind: "SNIPPET",
      title: "System prompt",
      description: "Paste into the agent node and adapt the tone.",
      language: "text",
      content:
        "You are an inbox assistant. For each email decide: category (sales, support, billing, other), urgency (high, normal) and whether a reply is needed. Draft replies in a friendly, concise tone. Never promise refunds or deadlines.",
    },
    { kind: "LINK", title: "Configuration sheet template", description: "Make a copy, then fill in your labels.", url: "https://example.com/config-sheet" },
  ];
  for (const [index, asset] of agentAssets.entries()) await createAsset(agent.id, null, asset, index);
  await db.productUpdate.createMany({
    data: [
      { productId: agent.id, version: "1.0.0", title: "First release", body: "<p>Labels, urgency flag and draft replies.</p>", publishedAt: daysAgo(55) },
      { productId: agent.id, version: "1.1.0", title: "Daily digest", body: "<p>Adds a morning summary of everything that was filed.</p>", publishedAt: daysAgo(28) },
      {
        productId: agent.id,
        version: "1.2.0",
        title: "Faster classification and escalation rules",
        body: "<ul><li>Classification is roughly twice as fast.</li><li>New escalation rules for billing emails.</li></ul><p>Download the new file from Files &amp; links and re-import.</p>",
        publishedAt: daysAgo(3),
      },
    ],
  });

  // ── Workflow ──────────────────────────────────────────────────────────────
  const workflow = await db.product.create({
    data: {
      ...base,
      type: "WORKFLOW",
      sku: "DEMO-WORKFLOW",
      title: "Lead-to-CRM Automation",
      slug: "lead-to-crm-automation",
      tagline: "Every new lead enriched, scored and added to your CRM automatically.",
      description: "<p>A ready-made workflow that catches leads from your forms, enriches them, scores them and creates the CRM record — with a Slack ping for the hot ones.</p>",
      categoryId: catNoCode.id,
      durationLabel: "15-minute setup",
      tags: ["Workflow", "CRM", "n8n"],
      price: 99900,
      version: "2.0",
      platform: "n8n",
      outcomes: ["Importable workflow file", "Scoring rules you can edit"],
      position: 3,
    },
  });
  await createCurriculum(workflow.id, [
    {
      title: "Setup",
      lessons: [
        { title: "Import the workflow", type: "TEXT", minutes: 3, content: "<p>Download the file from Files &amp; links, then use <em>Import from file</em> in n8n.</p>" },
        { title: "Connect your form and CRM", type: "TEXT", minutes: 6, content: "<p>Swap the placeholder credentials for your own and run the test webhook.</p>" },
      ],
    },
  ]);
  await createAsset(
    workflow.id,
    null,
    { kind: "FILE", title: "Lead-to-CRM workflow", fileName: "lead-to-crm-v2.json", mimeType: "application/json", body: WORKFLOW_JSON("Lead to CRM"), version: "2.0" },
    0,
  );
  await createAsset(
    workflow.id,
    null,
    { kind: "SNIPPET", title: "Test payload", language: "json", content: JSON.stringify({ name: "Test Lead", email: "lead@example.com", company: "Acme" }, null, 2) },
    1,
  );

  // ── Free digital product ──────────────────────────────────────────────────
  const pack = await db.product.create({
    data: {
      ...base,
      type: "DIGITAL",
      sku: "DEMO-PACK",
      title: "Prompt Starter Pack",
      slug: "prompt-starter-pack",
      tagline: "Twelve prompts we reach for every week. Free.",
      description: "<p>A small set of prompts for summarising, classifying and drafting — written to return output an automation can use.</p>",
      categoryId: catAi.id,
      tags: ["Free", "Prompts"],
      price: 0,
      version: "1.0",
      position: 4,
    },
  });
  await createAsset(pack.id, null, { kind: "SNIPPET", title: "Summarise a long email thread", language: "text", content: "Summarise the thread below in five bullet points. End with the single next action and who owns it." }, 0);
  await createAsset(pack.id, null, { kind: "SNIPPET", title: "Classify a support request", language: "text", content: 'Classify the message. Return JSON only: {"category": "billing" | "bug" | "how-to" | "other", "urgent": true | false}' }, 1);
  await createAsset(
    pack.id,
    null,
    { kind: "FILE", title: "All twelve prompts", fileName: "prompt-starter-pack.md", mimeType: "text/markdown", body: "# Prompt Starter Pack\n\nSample file from the demo content.\n" },
    2,
  );

  // ── Bundle ────────────────────────────────────────────────────────────────
  const bundle = await db.product.create({
    data: {
      ...base,
      type: "BUNDLE",
      sku: "DEMO-BUNDLE",
      title: "Automation Starter Bundle",
      slug: "automation-starter-bundle",
      tagline: "The course, the agent and the workflow — together.",
      description: "<p>Everything you need to learn the fundamentals and put two ready-made automations to work.</p>",
      categoryId: catAi.id,
      price: 649900,
      compareAtPrice: 849700,
      position: 5,
      bundleItems: {
        create: [
          { productId: course.id, position: 0 },
          { productId: agent.id, position: 1 },
          { productId: workflow.id, position: 2 },
        ],
      },
    },
  });

  // A draft, to show how unpublished work looks in the admin panel.
  await db.product.create({
    data: {
      type: "COURSE",
      sku: "DEMO-DRAFT",
      status: "DRAFT",
      title: "Advanced Agent Design",
      slug: "advanced-agent-design",
      tagline: "Multi-step agents with memory and tools.",
      categoryId: catAi.id,
      level: "ADVANCED",
    },
  });

  // ── Students ──────────────────────────────────────────────────────────────
  const demoPassword = await hashPassword(process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url"));
  const people = [
    ["student@example.com", "Aarav Sharma", 5],
    ["priya@example.com", "Priya Nair", 40],
    ["rohan@example.com", "Rohan Mehta", 22],
    ["sara@example.com", "Sara Khan", 16],
    ["vikram@example.com", "Vikram Rao", 1],
    ["ananya@example.com", "Ananya Iyer", 9],
    ["dev@example.com", "Dev Patel", 30],
    ["meera@example.com", "Meera Joshi", 12],
  ] as const;

  const users = new Map<string, string>();
  for (const [email, name, joinedDaysAgo] of people) {
    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash: demoPassword,
        emailVerifiedAt: daysAgo(joinedDaysAgo),
        createdAt: daysAgo(joinedDaysAgo),
        lastLoginAt: daysAgo(Math.min(joinedDaysAgo, 1)),
        lastActiveAt: daysAgo(Math.min(joinedDaysAgo, 1)),
      },
    });
    users.set(email, user.id);
  }

  const products: Record<string, { id: string; type: ProductType; licence: boolean }> = {
    course: { id: course.id, type: "COURSE", licence: false },
    workshop: { id: workshop.id, type: "WORKSHOP", licence: false },
    agent: { id: agent.id, type: "AGENT", licence: true },
    workflow: { id: workflow.id, type: "WORKFLOW", licence: false },
    pack: { id: pack.id, type: "DIGITAL", licence: false },
    bundle: { id: bundle.id, type: "BUNDLE", licence: false },
  };

  async function enroll(
    email: string,
    key: keyof typeof products,
    grantedDaysAgo: number,
    options: { source?: "API" | "MANUAL" | "FREE" | "IMPORT" | "BUNDLE"; bundleId?: string } = {},
  ) {
    const product = products[key];
    return db.enrollment.create({
      data: {
        userId: users.get(email)!,
        productId: product.id,
        source: options.source ?? "API",
        bundleId: options.bundleId ?? null,
        createdAt: daysAgo(grantedDaysAgo),
        lastAccessedAt: daysAgo(Math.min(grantedDaysAgo, 1)),
        licenseKey: product.licence ? generateLicenseKey() : null,
        externalRef: `demo-${randomReadable(8)}`,
      },
    });
  }

  await enroll("student@example.com", "course", 5);
  await enroll("student@example.com", "workshop", 4);
  await enroll("student@example.com", "agent", 3, { source: "MANUAL" });
  await enroll("student@example.com", "pack", 5, { source: "FREE" });
  await enroll("priya@example.com", "course", 40);
  await enroll("priya@example.com", "agent", 26);
  await enroll("rohan@example.com", "course", 22, { source: "IMPORT" });
  await enroll("rohan@example.com", "workflow", 20, { source: "IMPORT" });
  await enroll("sara@example.com", "course", 16);
  await enroll("sara@example.com", "workshop", 6);
  await enroll("vikram@example.com", "course", 1);
  await enroll("ananya@example.com", "bundle", 9);
  await enroll("ananya@example.com", "course", 9, { source: "BUNDLE", bundleId: bundle.id });
  await enroll("ananya@example.com", "agent", 9, { source: "BUNDLE", bundleId: bundle.id });
  await enroll("ananya@example.com", "workflow", 9, { source: "BUNDLE", bundleId: bundle.id });
  await enroll("dev@example.com", "agent", 30);
  await enroll("dev@example.com", "pack", 30, { source: "FREE" });
  await enroll("meera@example.com", "workshop", 12);
  await enroll("meera@example.com", "pack", 12, { source: "FREE" });

  // Course progress: how many lessons each learner has finished, and when.
  const courseProgress: [string, number, number][] = [
    ["student@example.com", 6, 5],
    ["priya@example.com", courseLessons.length, 38],
    ["rohan@example.com", 3, 20],
    ["sara@example.com", 9, 15],
    ["ananya@example.com", 5, 8],
  ];
  for (const [email, done, startedDaysAgo] of courseProgress) {
    const userId = users.get(email)!;
    for (let index = 0; index < done; index++) {
      const completedAt = daysAgo(Math.max(0, startedDaysAgo - Math.floor((index * startedDaysAgo) / Math.max(done, 1))), 2);
      await db.lessonProgress.create({
        data: { userId, lessonId: courseLessons[index], productId: course.id, completedAt, createdAt: completedAt },
      });
      const day = new Date(Date.UTC(completedAt.getUTCFullYear(), completedAt.getUTCMonth(), completedAt.getUTCDate()));
      await db.activityDay.upsert({
        where: { userId_day: { userId, day } },
        create: { userId, day, lessonsCompleted: 1 },
        update: { lessonsCompleted: { increment: 1 } },
      });
    }
    const percent = progressPercent(done, courseLessons.length);
    await db.enrollment.update({
      where: { userId_productId: { userId, productId: course.id } },
      data: {
        progressPercent: percent,
        lastLessonId: courseLessons[Math.min(done, courseLessons.length - 1)],
        completedAt: percent === 100 ? daysAgo(2) : null,
      },
    });
  }

  // Keep the main demo student on a visible streak, with a resume position and a note.
  const studentId = users.get("student@example.com")!;
  for (const offset of [0, 1, 2, 3]) {
    const date = daysAgo(offset);
    const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    await db.activityDay.upsert({ where: { userId_day: { userId: studentId, day } }, create: { userId: studentId, day, lessonsCompleted: 1 }, update: {} });
  }
  await db.lessonProgress.create({
    data: { userId: studentId, lessonId: courseLessons[6], productId: course.id, positionSeconds: 0 },
  });
  await db.note.create({
    data: {
      userId: studentId,
      lessonId: courseLessons[1],
      productId: course.id,
      body: "Start with the weekly report email — same steps every time, so it's a good first automation.",
    },
  });

  await db.certificate.create({
    data: {
      serial: `${randomReadable(4)}-${randomReadable(4)}-${randomReadable(4)}`,
      userId: users.get("priya@example.com")!,
      productId: course.id,
      studentName: "Priya Nair",
      productTitle: course.title,
      issuedAt: daysAgo(2),
    },
  });

  await db.announcement.createMany({
    data: [
      {
        title: "Welcome to the academy 👋",
        body: "<p>Everything you own is in <strong>My library</strong>. Pick up where you left off from the home screen, and check <strong>Live sessions</strong> for upcoming workshops.</p>",
        audience: "ALL",
        isPinned: true,
        publishedAt: daysAgo(6),
      },
      {
        title: "New bonus module is live",
        body: "<p>We've added <em>Monitoring and error handling</em> to AI Automation Foundations. It unlocks a week after you join.</p>",
        audience: "PRODUCT",
        productId: course.id,
        publishedAt: daysAgo(2),
      },
    ],
  });

  await db.notification.createMany({
    data: [
      { userId: studentId, type: "update", title: "Inbox Triage Agent v1.2.0 is out", body: "Faster classification and new escalation rules.", href: "/learn/inbox-triage-agent?tab=updates", createdAt: daysAgo(3) },
      { userId: studentId, type: "live", title: "Session 1 — Design the agent starts in 3 days", href: "/live", createdAt: daysAgo(0, 3) },
      { userId: studentId, type: "access", title: "You now have access to Inbox Triage Agent", href: "/learn/inbox-triage-agent", createdAt: daysAgo(3, 2), readAt: daysAgo(3) },
    ],
  });

  console.log(`✓ Sample content: 6 products, ${people.length} students`);
  if (process.env.SEED_DEMO_PASSWORD) console.log("  Demo student: student@example.com (password from SEED_DEMO_PASSWORD)");
}

async function main() {
  await seedOwner();
  await seedPages();
  if (process.env.SEED_DEMO !== "false") await seedDemo();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
