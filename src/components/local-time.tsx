"use client";

import { useId } from "react";

type Format = "datetime" | "date" | "time" | "weekday-datetime" | "day";

const FORMATS: Record<Format, Intl.DateTimeFormatOptions> = {
  datetime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  "weekday-datetime": { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
  date: { day: "numeric", month: "short", year: "numeric" },
  day: { weekday: "long", day: "numeric", month: "long" },
  time: { hour: "numeric", minute: "2-digit" },
};

/**
 * Shows an instant in the viewer's own time zone — essential for live session times.
 *
 * The server can't know the browser's zone, so it renders the site's zone and an inline script
 * rewrites the text before first paint; client-side navigations format directly in the browser.
 */
export function LocalTime({
  date,
  format = "datetime",
  showZone = false,
  fallbackZone,
  className,
}: {
  date: Date | string;
  format?: Format;
  /** Append the zone abbreviation, e.g. "7:30 pm IST". */
  showZone?: boolean;
  /** Zone used for the server-rendered text (the site's time zone). */
  fallbackZone?: string;
  className?: string;
}) {
  const id = useId();
  const iso = typeof date === "string" ? date : date.toISOString();
  const options: Intl.DateTimeFormatOptions = { ...FORMATS[format], ...(showZone ? { timeZoneName: "short" } : {}) };
  const isServer = typeof window === "undefined";

  let text: string;
  try {
    text = new Intl.DateTimeFormat(isServer ? "en-IN" : undefined, {
      ...options,
      ...(isServer && fallbackZone ? { timeZone: fallbackZone } : {}),
    }).format(new Date(iso));
  } catch {
    text = new Date(iso).toUTCString();
  }

  const script = `(function(){var e=document.getElementById(${JSON.stringify(id)});if(e)try{e.textContent=new Intl.DateTimeFormat(undefined,${JSON.stringify(options)}).format(new Date(${JSON.stringify(iso)}))}catch(x){}})()`;

  return (
    <>
      <time id={id} dateTime={iso} className={className} suppressHydrationWarning>
        {text}
      </time>
      <script
        type={isServer ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: script }}
      />
    </>
  );
}
