/**
 * An account with no uploaded picture still gets a face: a GitHub-style
 * identicon — a mirrored block pattern in a seeded colour — derived from a
 * stable seed (the user id where there is one, otherwise the email or name).
 * Random-looking, never actually random, or a peer would change face on every
 * render.
 *
 * The seed is the same idea as `peerColor`, but a continuous hue rather than a
 * seven-entry palette, because two collaborators sharing a cursor colour is
 * fine and two accounts sharing a face is not.
 */

export const AVATAR_GRID = 5;
const HALF = Math.ceil(AVATAR_GRID / 2);

export type AvatarFace = {
  hue: number;
  background: string;
  /** The blocks, drawn over the background. */
  foreground: string;
  /** `[column, row]` pairs on an `AVATAR_GRID`-square grid, already mirrored. */
  cells: [number, number][];
};

const hash = (seed: string) => [...seed].reduce((h, char) => Math.imul(h ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** xorshift32 — enough bits for a hue and fifteen half-cells, and the same ones every time. */
const random = (seed: number) => {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
};

export function avatarFace(seed?: string | null): AvatarFace {
  const next = random(hash((seed || "").trim().toLowerCase() || "guest"));
  const hue = Math.floor(next() * 360);
  // Rank the half-grid by weight and light the top `count`, rather than
  // flipping each cell independently — a per-cell coin toss produces the
  // occasional near-empty or near-full face, and this cannot.
  const weights = Array.from({ length: HALF * AVATAR_GRID }, () => next());
  const count = 6 + Math.floor(next() * 4);
  const lit = [...weights.keys()].sort((a, b) => weights[b]! - weights[a]!).slice(0, count);
  return {
    hue,
    background: `oklch(0.64 0.16 ${hue})`,
    foreground: "oklch(0.99 0 0 / 0.92)",
    cells: lit
      .flatMap((index) => {
        const [column, row] = [index % HALF, Math.floor(index / HALF)];
        return column === HALF - 1 && AVATAR_GRID % 2
          ? ([[column, row]] as [number, number][])
          : ([[column, row], [AVATAR_GRID - 1 - column, row]] as [number, number][]);
      })
      .sort(([ax, ay], [bx, by]) => ay - by || ax - bx),
  };
}
