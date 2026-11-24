import "server-only";
import sanitizeHtml from "sanitize-html";

const RICH_TEXT: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "mark", "a", "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "hr", "img", "span", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    code: ["class"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const attributes: Record<string, string> = { href };
      if (/^https?:\/\//i.test(href)) {
        attributes.target = "_blank";
        attributes.rel = "noopener noreferrer";
      }
      return { tagName, attribs: attributes };
    },
  },
};

/**
 * Cleans rich text written in the admin editor. Applied when content is saved and again when
 * it is rendered, so nothing that can run script ever reaches a student's browser.
 */
export function sanitizeRichText(html: string | null | undefined) {
  if (!html) return "";
  const clean = sanitizeHtml(html, RICH_TEXT).trim();
  // An editor that was emptied still emits an empty paragraph.
  return clean === "<p></p>" ? "" : clean;
}

/** True when rich text has no visible content. */
export function isRichTextEmpty(html: string | null | undefined) {
  if (!html) return true;
  return sanitizeHtml(html, { allowedTags: ["img"], allowedAttributes: { img: ["src"] } }).trim().length === 0;
}

/** Strips every tag — for values that must be plain text. */
export function plainText(value: string | null | undefined) {
  if (!value) return "";
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}
