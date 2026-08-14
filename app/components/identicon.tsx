import { memo } from "react";
import { AVATAR_GRID, avatarFace } from "@/app/lib/avatar";

/**
 * The generated face for an account with no picture. Drawn as inline SVG
 * rather than an `<img>` so it needs no request, no data URI and no external
 * avatar service — this app is self-hosted and may have no internet at all.
 *
 * Decorative by design: the surrounding avatar already carries the name in its
 * label, so this is hidden from assistive tech.
 */
export const Identicon = memo(function Identicon({ seed, className }: { seed?: string | null; className?: string }) {
  const { background, foreground, cells } = avatarFace(seed);
  return (
    <svg viewBox={`0 0 ${AVATAR_GRID} ${AVATAR_GRID}`} className={className} aria-hidden focusable="false">
      <rect width={AVATAR_GRID} height={AVATAR_GRID} fill={background} />
      {cells.map(([column, row]) => (
        <rect key={`${column}-${row}`} x={column} y={row} width="1" height="1" rx="0.22" fill={foreground} />
      ))}
    </svg>
  );
});
