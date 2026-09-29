"use client";

import {
  createContext,
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSchema } from "@/app/hooks/use-schema";
import { analyzeQueries, type QueryAnalysis } from "@/app/lib/query-analysis";
import {
  columnImpact,
  impactHighlight,
  type ImpactItem,
  type ImpactTarget,
} from "@/app/lib/impact";

export type OverlayContextValue = {
  /** Whether the canvas is tinted by query heat. */
  heatmap: boolean;
  setHeatmap: React.Dispatch<React.SetStateAction<boolean>>;
  /** Derived from the saved queries; read by the Queries tab and the canvas alike. */
  analysis: QueryAnalysis;
  /** The column whose blast radius is showing, or `null`. */
  impactTarget: ImpactTarget | null;
  setImpactTarget: (target: ImpactTarget | null) => void;
  impact: ImpactItem[];
  /** What the canvas lights while `impactTarget` is set. */
  impactLit: ReturnType<typeof impactHighlight> | null;
};

export const OverlayContext = createContext<OverlayContextValue | null>(null);

/**
 * The two analysis overlays. Both are derived from the schema, so this sits
 * below `SchemaProvider`; neither is gesture state, so it changes when the
 * schema or the user's choice does and never per frame.
 *
 * The canvas applies them the way it applies focus dimming -- classes and
 * `data-heat` toggled on the nodes already in the DOM -- so turning one on
 * re-renders no card.
 */
export function OverlayProvider({ children }: { children: ReactNode }) {
  const { schema } = useSchema();
  const [heatmap, setHeatmap] = useState(false);
  const [target, setImpactTarget] = useState<ImpactTarget | null>(null);

  // Deferred like validation: a keystroke in a query should not wait on a re-analysis.
  const deferred = useDeferredValue(schema);
  const { tables, relationships, queries } = deferred;
  // Keyed on the three collections it reads, not on `deferred`, which a moved memo also replaces.
  const analysis = useMemo(
    () => analyzeQueries({ ...deferred, tables, relationships, queries }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tables, relationships, queries],
  );

  // A column deleted out from under the panel closes it rather than leaving it pointing at nothing.
  const impactTarget = useMemo(
    () =>
      target &&
      schema.tables
        .find((table) => table.id === target.tableId)
        ?.columns.some((column) => column.id === target.columnId)
        ? target
        : null,
    [schema.tables, target],
  );
  const impact = useMemo(
    () =>
      impactTarget
        ? columnImpact(schema, impactTarget, analysis.perQuery)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [impactTarget, schema.tables, schema.relationships, schema.queries, analysis],
  );
  const impactLit = useMemo(
    () => (impactTarget ? impactHighlight(impactTarget, impact) : null),
    [impactTarget, impact],
  );

  const value = useMemo(
    () => ({
      heatmap,
      setHeatmap,
      analysis,
      impactTarget,
      setImpactTarget,
      impact,
      impactLit,
    }),
    [heatmap, analysis, impactTarget, impact, impactLit],
  );
  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
}
