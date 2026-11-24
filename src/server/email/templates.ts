import "server-only";
import { PRODUCT_TYPE_NOUNS } from "@/lib/labels";
import type { ProductType } from "@/generated/prisma/enums";
import type { EmailContent } from "@/server/email/render";
import { absoluteUrl } from "@/server/url";

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";

export const emails = {
  loginCode(input: { name: string; code: string; url: string; siteName: string }): EmailContent {
    return {
      subject: `${input.code} is your ${input.siteName} sign-in code`,
      preheader: "Use this code to sign in. It expires in 15 minutes.",
      heading: "Your sign-in code",
      paragraphs: [`Hi ${firstName(input.name)}, enter this code to sign in. It works once and expires in 15 minutes.`],
      code: input.code,
      button: { label: "Sign in with one click", url: input.url },
      footnote: "If you didn't ask to sign in, you can ignore this email — nobody can get in without it.",
    };
  },

  verifyEmail(input: { name: string; url: string }): EmailContent {
    return {
      subject: "Confirm your email address",
      heading: "Confirm your email",
      paragraphs: [`Hi ${firstName(input.name)}, please confirm this is your email address so we can keep your account secure.`],
      button: { label: "Confirm email", url: input.url },
      footnote: "This link expires in 48 hours.",
    };
  },

  passwordReset(input: { name: string; url: string }): EmailContent {
    return {
      subject: "Reset your password",
      heading: "Reset your password",
      paragraphs: [`Hi ${firstName(input.name)}, use the button below to choose a new password.`],
      button: { label: "Choose a new password", url: input.url },
      footnote: "This link expires in 1 hour. If you didn't request it, your password is unchanged.",
    };
  },

  welcome(input: { name: string; siteName: string }): EmailContent {
    return {
      subject: `Welcome to ${input.siteName}`,
      heading: `Welcome, ${firstName(input.name)}!`,
      paragraphs: [
        "Your account is ready. Everything you buy — courses, workshops, agents and workflows — will show up in your library.",
      ],
      button: { label: "Go to my dashboard", url: absoluteUrl("/dashboard") },
    };
  },

  accessGranted(input: {
    name: string;
    productTitle: string;
    productType: ProductType;
    productUrl: string;
    /** For accounts created by a purchase: a one-click link that signs them in and lets them set a password. */
    setupUrl?: string | null;
    email: string;
    licenseKey?: string | null;
    expiresText?: string | null;
  }): EmailContent {
    const details: [string, string][] = [["Signed in as", input.email]];
    if (input.licenseKey) details.push(["Licence key", input.licenseKey]);
    if (input.expiresText) details.push(["Access until", input.expiresText]);
    return {
      subject: `You now have access to ${input.productTitle}`,
      preheader: `Your ${PRODUCT_TYPE_NOUNS[input.productType]} is ready.`,
      heading: "You're in!",
      paragraphs: input.setupUrl
        ? [
            `Hi ${firstName(input.name)}, your ${PRODUCT_TYPE_NOUNS[input.productType]} “${input.productTitle}” is ready.`,
            "We created an account for you with this email address. Use the button below to sign in and set your password.",
          ]
        : [
            `Hi ${firstName(input.name)}, your ${PRODUCT_TYPE_NOUNS[input.productType]} “${input.productTitle}” has been added to your library.`,
          ],
      details,
      button: input.setupUrl
        ? { label: "Sign in and get started", url: input.setupUrl }
        : { label: "Open it now", url: input.productUrl },
      footnote: input.setupUrl ? "This sign-in link works once and expires in 7 days. After that, use “Forgot password” to get in." : undefined,
    };
  },

  orderReceipt(input: {
    name: string;
    orderNumber: string;
    items: string[];
    total: string;
    url: string;
  }): EmailContent {
    return {
      subject: `Receipt for order ${input.orderNumber}`,
      heading: "Thanks for your order",
      paragraphs: [`Hi ${firstName(input.name)}, we've received your payment. Here is a summary for your records.`],
      details: [["Order", input.orderNumber], ...input.items.map((item): [string, string] => ["Item", item]), ["Total paid", input.total]],
      button: { label: "View invoice", url: input.url },
    };
  },

  certificateIssued(input: { name: string; productTitle: string; url: string }): EmailContent {
    return {
      subject: `Your certificate for ${input.productTitle}`,
      heading: "Congratulations! 🎓",
      paragraphs: [
        `${firstName(input.name)}, you completed “${input.productTitle}”. Your certificate is ready to download and share.`,
      ],
      button: { label: "View my certificate", url: input.url },
    };
  },

  announcement(input: { title: string; bodyHtml: string; url: string }): EmailContent {
    return {
      subject: input.title,
      heading: input.title,
      html: input.bodyHtml,
      button: { label: "Open in the portal", url: input.url },
    };
  },

  liveReminder(input: {
    name: string;
    sessionTitle: string;
    productTitle: string;
    when: string;
    startsIn: string;
    url: string;
  }): EmailContent {
    return {
      subject: `Starting ${input.startsIn}: ${input.sessionTitle}`,
      heading: `Your live session starts ${input.startsIn}`,
      paragraphs: [`Hi ${firstName(input.name)}, a reminder for your upcoming session.`],
      details: [
        ["Session", input.sessionTitle],
        ["Part of", input.productTitle],
        ["When", input.when],
      ],
      button: { label: "Open the session page", url: input.url },
      footnote: "The join button becomes active shortly before the session starts.",
    };
  },

  productUpdate(input: { name: string; productTitle: string; version?: string | null; title: string; url: string }): EmailContent {
    return {
      subject: `Update for ${input.productTitle}${input.version ? ` — v${input.version}` : ""}`,
      heading: input.title,
      paragraphs: [
        `Hi ${firstName(input.name)}, there's a new update for “${input.productTitle}”${input.version ? ` (version ${input.version})` : ""}. The latest files are in your library.`,
      ],
      button: { label: "See what's new", url: input.url },
    };
  },

  threadReply(input: { name: string; replier: string; threadTitle: string; snippet: string; url: string }): EmailContent {
    return {
      subject: `${input.replier} replied: ${input.threadTitle}`,
      heading: "New reply to your question",
      paragraphs: [`Hi ${firstName(input.name)}, ${input.replier} replied to “${input.threadTitle}”:`, `“${input.snippet}”`],
      button: { label: "View the reply", url: input.url },
    };
  },

  submissionReviewed(input: {
    name: string;
    lessonTitle: string;
    passed: boolean;
    grade?: string | null;
    feedback?: string | null;
    url: string;
  }): EmailContent {
    return {
      subject: input.passed ? `Your assignment passed: ${input.lessonTitle}` : `Feedback on your assignment: ${input.lessonTitle}`,
      heading: input.passed ? "Your assignment passed" : "Your assignment needs another look",
      paragraphs: [
        `Hi ${firstName(input.name)}, your submission for “${input.lessonTitle}” has been reviewed.`,
        ...(input.feedback ? [`Feedback: ${input.feedback}`] : []),
      ],
      details: input.grade ? [["Grade", input.grade]] : undefined,
      button: { label: "Open the assignment", url: input.url },
    };
  },

  ticketReply(input: { name: string; subject: string; snippet: string; url: string }): EmailContent {
    return {
      subject: `Re: ${input.subject}`,
      heading: "We replied to your support request",
      paragraphs: [`Hi ${firstName(input.name)}, here's our reply:`, `“${input.snippet}”`],
      button: { label: "View the conversation", url: input.url },
    };
  },

  ticketForStaff(input: { studentName: string; subject: string; snippet: string; url: string; isNew: boolean }): EmailContent {
    return {
      subject: `${input.isNew ? "New ticket" : "Ticket reply"}: ${input.subject}`,
      heading: input.isNew ? "A student opened a support ticket" : "A student replied to a ticket",
      paragraphs: [`${input.studentName} wrote:`, `“${input.snippet}”`],
      button: { label: "Open in the admin panel", url: input.url },
    };
  },

  teamInvite(input: { name: string; role: string; siteName: string; url: string }): EmailContent {
    return {
      subject: `You've been added to the ${input.siteName} team`,
      heading: "You're on the team",
      paragraphs: [
        `Hi ${firstName(input.name)}, you've been given ${input.role} access to ${input.siteName}. Use the button below to sign in and set your password.`,
      ],
      button: { label: "Accept and sign in", url: input.url },
      footnote: "This link works once and expires in 7 days.",
    };
  },

  test(input: { siteName: string }): EmailContent {
    return {
      subject: `Test email from ${input.siteName}`,
      heading: "Email is working",
      paragraphs: ["This is a test message sent from Admin → Settings → Email. If you can read it, your email provider is set up correctly."],
    };
  },
};
