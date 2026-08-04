"use client";

import { useMemo, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { generateDDL, generateDML } from "@/app/lib/generators";
import type { Schema } from "@/app/lib/schema";
import type { ValidationIssue } from "@/app/lib/validation";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ExportTab = "ddl" | "dml" | "combined";

const exportTabs = [
  ["ddl", "DDL"],
  ["dml", "DML"],
  ["combined", "Combined"],
] as const satisfies ReadonlyArray<readonly [ExportTab, string]>;

const SQL_TOKEN = /(--[^\n]*|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\b(?:CREATE|ALTER|DROP|TABLE|COLUMN|CONSTRAINT|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|CHECK|NOT|NULL|DEFAULT|AS|BEGIN|END|PACKAGE|BODY|PROCEDURE|FUNCTION|INSERT|INTO|VALUES|UPDATE|SET|DELETE|FROM|WHERE|RETURNING|INTO|COMMIT)\b)/gi;

function highlightSql(source: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  SQL_TOKEN.lastIndex = 0;
  while ((match = SQL_TOKEN.exec(source))) {
    if (match.index > cursor) pieces.push(source.slice(cursor, match.index));
    const token = match[0];
    const kind = token.startsWith("--")
      ? "comment"
      : token.startsWith("'")
        ? "string"
        : /^\d/.test(token)
          ? "number"
          : "keyword";
    pieces.push(
      <span className={`sql-token ${kind}`} key={`${match.index}-${token}`}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }
  if (cursor < source.length) pieces.push(source.slice(cursor));
  return pieces;
}

export const ExportModal = ({
  isOpen,
  onOpenChange,
  schema,
  errors,
  onClearInvalidForeignKeys,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
  errors: ValidationIssue[];
  onClearInvalidForeignKeys: () => void;
}) => {
  const [exportTab, setExportTab] = useState<ExportTab>("ddl");
  const [copied, setCopied] = useState(false);
  const ddl = useMemo(
    () => (isOpen && exportTab !== "dml" ? generateDDL(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const dml = useMemo(
    () => (isOpen && exportTab !== "ddl" ? generateDML(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const output =
    exportTab === "ddl" ? ddl : exportTab === "dml" ? dml : `${ddl}\n\n${dml}`;

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([output], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportTab === "dml" ? "dml.sql" : "schema.sql";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-3xl"
    >
      <DialogHeader>
        <DialogTitle className="sr-only">Export SQL</DialogTitle>
      </DialogHeader>
      <Tabs
        selectedKey={exportTab}
        onSelectionChange={(key) => setExportTab(key as ExportTab)}
      >
        <div className="flex items-center justify-between gap-2 pr-10">
          <TabsList>
            {exportTabs.map(([key, label]) => (
              <TabsTrigger key={key} id={key}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Copy export" onClick={copyOutput}>
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Download export" onClick={download}>
              <HugeiconsIcon icon={Download04Icon} />
            </Button>
          </div>
        </div>
        {errors.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <HugeiconsIcon icon={Cancel01Icon} />
            <AlertTitle>
              Export blocked: {errors[0].message} ({errors.length} error(s))
            </AlertTitle>
            <AlertAction>
              <Button variant="outline" onClick={onClearInvalidForeignKeys}>
                Clear invalid references
              </Button>
            </AlertAction>
          </Alert>
        )}
        {exportTabs.map(([key]) => (
          <TabsContent key={key} id={key}>
            <pre className="code">
              <code>{highlightSql(output)}</code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </Dialog>
  );
};
