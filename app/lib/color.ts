/**
 * Contrast helpers for table-card headers.
 *
 * Header colors come from the user-facing PALETTE, which spans light ambers to
 * deep blues. Pinning the label to white fails WCAG on the lighter half, so the
 * foreground is derived from the background instead of assumed.
 */

const INK = "#12203A";
const PAPER = "#FFFFFF";

function channel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function parseHex(hex: string) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.1 relative luminance. */
export function luminance(hex: string) {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors, 1–21. */
export function contrastRatio(a: string, b: string) {
  const first = luminance(a);
  const second = luminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;

function toHex(value: number) {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, "0");
}

/** Blend `hex` toward `target` by `amount` (0–1). */
function mix(hex: string, target: string, amount: number) {
  const from = parseHex(hex);
  const to = parseHex(target);
  return `#${(["r", "g", "b"] as const)
    .map((key) => toHex(from[key] + (to[key] - from[key]) * amount))
    .join("")}`;
}

/**
 * A foreground that clears WCAG AA on `background`.
 *
 * Prefers the tinted ink/paper pair for looks, but mid-tone backgrounds sit in
 * a dead zone where neither clears 4.5:1 — there the ink is pushed toward pure
 * black or white until it does. Every color clears AA against one extreme or
 * the other, so this always terminates with a passing result.
 */
export function readableTextOn(background: string) {
  const onPaper = contrastRatio(background, PAPER);
  const onInk = contrastRatio(background, INK);
  if (Math.max(onPaper, onInk) >= AA_NORMAL) return onPaper >= onInk ? PAPER : INK;

  // Dead zone: pick the extreme with headroom, not the currently-better tint.
  // Paper is already maximally light, so a failing paper has nowhere to go.
  const towardBlack =
    contrastRatio(background, "#000000") >= contrastRatio(background, "#FFFFFF");
  const base = towardBlack ? INK : PAPER;
  const extreme = towardBlack ? "#000000" : "#FFFFFF";
  for (let amount = 0.25; amount <= 1; amount += 0.25) {
    const candidate = mix(base, extreme, amount);
    if (contrastRatio(background, candidate) >= AA_NORMAL) return candidate;
  }
  return extreme;
}

/**
 * A translucent chip that sits on a colored header without dropping below the
 * legibility floor — dark headers get a light veil, light headers a dark one.
 */
export function chipBackgroundOn(background: string) {
  return readableTextOn(background) === PAPER
    ? "rgba(255,255,255,0.22)"
    : "rgba(0,0,0,0.14)";
}
