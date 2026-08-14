"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useSchema } from "@/app/hooks";
import { highlightSql } from "../highlight";

/**
 * The generated DDL, shown in place of the structure tabs. `ddl` is only
 * generated while this view is the visible one — see `SchemaContext`.
 */
export function CodeView() {
  const { ddl } = useSchema();
  return (
    <ScrollArea className="panel-code">
      <pre>
        <code>{highlightSql(ddl)}</code>
      </pre>
    </ScrollArea>
  );
}
