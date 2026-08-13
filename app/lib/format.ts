/**
 * Timestamps rendered on the server, so every card in a list agrees on locale and
 * time zone. Formatting on the client would read the viewer's zone but mismatch
 * the server-rendered HTML during hydration.
 */
export const formatTimestamp = (date: Date) =>
  date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
