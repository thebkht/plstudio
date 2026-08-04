import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseIcon } from "@hugeicons/core-free-icons";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-label="PLStudio">
      <span className="brand-mark-icon" aria-hidden="true"><HugeiconsIcon icon={DatabaseIcon} size={compact ? 16 : 19} /></span>
      {!compact && <span className="brand-mark-word">PL<span>Studio</span></span>}
    </span>
  );
}
