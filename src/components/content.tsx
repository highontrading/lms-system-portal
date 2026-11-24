import * as React from "react";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/server/sanitize";

/** Renders rich text authored in the admin panel. Server component — sanitises before output. */
export function RichText({ html, className, small }: { html: string | null | undefined; className?: string; small?: boolean }) {
  const clean = sanitizeRichText(html);
  if (!clean) return null;
  return <div className={cn("rich", small && "rich-sm", className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}

const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Renders text written by students (questions, replies, notes, tickets). It is never treated
 * as HTML: line breaks are kept and web links become clickable, nothing else.
 */
export function PlainText({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed [overflow-wrap:anywhere]", className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>
          {paragraph.split("\n").map((line, lineIndex, lines) => (
            <React.Fragment key={lineIndex}>
              {line.split(URL_PATTERN).map((part, partIndex) =>
                partIndex % 2 === 1 ? (
                  <a
                    key={partIndex}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="font-medium text-primary-text underline underline-offset-2"
                  >
                    {part}
                  </a>
                ) : (
                  part
                ),
              )}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
