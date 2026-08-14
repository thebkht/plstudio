"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLayout, useSchema, useSelect } from "@/app/hooks";

/** The validation drawer pinned under the panel footer. */
export function Issues() {
  const { issues, errors } = useSchema();
  const { issuesOpen, setIssuesOpen } = useLayout();
  const { selectTable } = useSelect();
  return (
    <Collapsible
      className="issues-bar"
      isExpanded={issuesOpen}
      onExpandedChange={setIssuesOpen}
    >
      <CollapsibleTrigger className="issues-head">
        <HugeiconsIcon
          icon={Alert02Icon}
          className={errors.length ? "warn danger" : "warn"}
        />
        <span>Issues</span>
        <Badge variant={errors.length ? "destructive" : "secondary"}>
          {issues.length}
        </Badge>
        <HugeiconsIcon icon={ArrowDown01Icon} className="issues-chevron" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea className="issues-list">
          {!issues.length ? (
            <p className="issues-empty">No problems found.</p>
          ) : (
            issues.slice(0, 40).map((issue) => (
              <Button
                variant="ghost"
                className={`issue ${issue.severity}`}
                key={`${issue.message}-${issue.columnId ?? issue.tableId ?? ""}`}
                onClick={() => issue.tableId && selectTable(issue.tableId)}
              >
                {issue.message}
              </Button>
            ))
          )}
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
