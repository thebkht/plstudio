/**
 * An account with no uploaded picture still gets a face: a gradient derived
 * from a stable seed (the user id where there is one, otherwise the email or
 * name), so the same person is always the same colour — random-looking, never
 * actually random, or a peer would change face on every render.
 *
 * The seed is the same idea as `peerColor`, but a continuous hue rather than a
 * seven-entry palette, because two collaborators sharing a cursor colour is
 * fine and two accounts sharing a face is not.
 */

const hash = (seed: string) => Math.abs([...seed].reduce((h, char) => (h * 31 + char.charCodeAt(0)) | 0, 7));

/** Inline style for an `AvatarFallback`: seeded two-stop gradient, legible text on top. */
export function avatarGradient(seed?: string | null) {
  const hue = hash((seed || "").trim().toLowerCase() || "guest") % 360;
  return {
    background: `linear-gradient(140deg, oklch(0.74 0.15 ${hue}), oklch(0.56 0.17 ${(hue + 48) % 360}))`,
    color: "oklch(0.99 0 0)",
  };
}
