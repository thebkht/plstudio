"use client";

import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCanvasCommands, useOverlay, useSchema } from "@/app/hooks";
import type { ImpactItem, ImpactKind } from "@/app/lib/impact";
import type { Table } from "@/app/lib/schema";

/** In the order a DBA would read them: the table's own keys first, the code that uses it last. */
const SECTIONS: [ImpactKind, string][] = [
  ["key", "Primary key"],
  ["unique", "Unique constraints"],
  ["check", "Checks"],
  ["index", "Indexes"],
  ["sequence", "Generated key"],
  ["fk-in", "Foreign keys pointing at it"],
  ["fk-out", "Foreign key it holds"],
  ["plsql", "PL/SQL package"],
  ["query", "Saved queries"],
];

/**
 * The blast radius of the column `impactTarget` names, beside the canvas that
 * is showing it. Screen space, like the dock: it is read, not placed.
 */
export function ImpactPanel() {
  const { impactTarget, impact, setImpactTarget } = useOverlay();
  const { tablesById } = useSchema();
  const { revealTables } = useCanvasCommands();

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setImpactTarget(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [setImpactTarget]);

  if (!impactTarget) return null;
  const table = tablesById.get(impactTarget.tableId);
  const column = table?.columns.find((candidate) => candidate.id === impactTarget.columnId);
  if (!table || !column) return null;
  const drops = impact.filter((item) => item.drop).length;
  const renames = impact.filter((item) => item.rename).length;
  const reveal = (item: ImpactItem) =>
    revealTables(item.tableIds.map((id) => tablesById.get(id)).filter((candidate): candidate is Table => Boolean(candidate)));

  return (
    <section className="impact-panel" aria-label={`Impact of ${table.name}.${column.name}`}>
      <header className="impact-panel-head">
        <HugeiconsIcon icon={Target02Icon} size={16} aria-hidden="true" />
        <h2>
          <code>{table.name.toUpperCase()}.{column.name.toUpperCase()}</code>
        </h2>
        <Button size="icon-sm" variant="ghost" aria-label="Close impact analysis" onClick={() => setImpactTarget(null)}>
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      </header>
      <p className="hint">
        {impact.length
          ? `Dropping it breaks ${drops}, renaming it breaks ${renames}.`
          : "Nothing else depends on this column."}
      </p>
      {SECTIONS.map(([kind, title]) => {
        const items = impact.filter((item) => item.kind === kind);
        if (!items.length) return null;
        return (
          <div className="impact-section" key={kind}>
            <h3>{title}</h3>
            {items.map((item, index) => (
              <button type="button" className="impact-item" key={`${item.label}-${index}`} onClick={() => reveal(item)}>
                <span className="impact-item-head">
                  <code>{item.label}</code>
                  {item.drop && <Badge variant="destructive">Drop</Badge>}
                  {item.rename && <Badge variant="outline">Rename</Badge>}
                </span>
                <span className="hint">{item.detail}</span>
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
