import { Database } from "lucide-react";

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-label="DrawSQL">
      <span className="brand-mark-icon" aria-hidden="true"><Database size={compact ? 16 : 19} /></span>
      {!compact && <span className="brand-mark-word">draw<span>SQL</span></span>}
    </span>
  );
}
