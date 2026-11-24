export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** Calendar day ("2026-11-24") of an instant in a given time zone. */
export function dayKey(date: Date, timeZone = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** A day key as a Date at UTC midnight — the shape PostgreSQL `date` columns round-trip through. */
export function dayKeyToDate(key: string) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function shiftDayKey(key: string, days: number) {
  return addDays(dayKeyToDate(key), days).toISOString().slice(0, 10);
}

/**
 * Learning streaks from a list of active day keys.
 * The current streak stays alive through today: it only breaks once a full day is missed.
 */
export function computeStreak(activeDays: string[], today: string) {
  const days = new Set(activeDays);
  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...days].sort()) {
    run = previous && shiftDayKey(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  let current = 0;
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDayKey(cursor, -1);
  }
  return { current, longest, activeToday: days.has(today) };
}

/** `<input type="datetime-local">` value for an instant, in the given time zone. */
export function toLocalInputValue(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - instant.getTime();
}

/** Interprets a wall-clock `datetime-local` value ("2026-12-01T19:30") in a time zone and returns the instant. */
export function fromLocalInputValue(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  try {
    // Two passes settle correctly around daylight-saving transitions.
    let instant = guess - zoneOffsetMs(new Date(guess), timeZone);
    instant = guess - zoneOffsetMs(new Date(instant), timeZone);
    return new Date(instant);
  } catch {
    return new Date(guess);
  }
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
