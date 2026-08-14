import { memo } from "react";
import { AVATAR_VIEWBOX, avatarFace } from "@/app/lib/avatar";

/**
 * The generated face for an account with no picture. Drawn as inline SVG
 * rather than an `<img>` so it needs no request, no data URI and no external
 * avatar service — this app is self-hosted and may have no internet at all.
 *
 * Decorative by design: the surrounding avatar already carries the name in its
 * label, so this is hidden from assistive tech.
 */
export const Identicon = memo(function Identicon({
  seed,
  variantIndex,
  className,
}: {
  seed?: string | null;
  variantIndex?: number;
  className?: string;
}) {
  const { background, foreground, path } = avatarFace(seed, variantIndex);
  return (
    <svg
      viewBox={`0 0 ${AVATAR_VIEWBOX} ${AVATAR_VIEWBOX}`}
      className={className}
      shapeRendering="crispEdges"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
    >
      <rect width={AVATAR_VIEWBOX} height={AVATAR_VIEWBOX} fill={background} />
      <path d={path} fill={foreground} />
    </svg>
  );
});
