/**
 * Timestamps rendered on the server, so every card in a list agrees on locale and
 * time zone. Formatting on the client would read the viewer's zone but mismatch
 * the server-rendered HTML during hydration.
 */
export const formatTimestamp = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];

/**
 * "Yesterday" is scanned; "Aug 13, 2026, 4:59 PM" has to be read. Cards show
 * this and keep formatTimestamp as the title, so the exact stamp is one hover
 * away rather than occupying two lines of every card.
 */
export const formatRelative = (date: Date, now: Date = new Date()) => {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const step = STEPS.find(([, size]) => Math.abs(seconds) >= size);
  return step ? RELATIVE.format(Math.round(seconds / step[1]), step[0]) : RELATIVE.format(0, "second");
};
