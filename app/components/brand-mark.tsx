import { DatabaseIcon } from "lucide-react";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-label="PLStudio">
      <span className="brand-mark-icon" aria-hidden="true"><DatabaseIcon size={compact ? 14 : 15} /></span>
      {!compact && <span className="brand-mark-word">PLStudio</span>}
    </span>
  );
}
