"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { generateDDL, generateDML, generateMermaidER } from "@/app/lib/generators";
import { exportSchemaJson } from "@/app/lib/schema-json";
import type { Schema } from "@/app/lib/schema";
import type { ValidationIssue } from "@/app/lib/validation";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { highlightJson, highlightMermaid, highlightSql } from "../../highlight";

type ExportTab = "ddl" | "dml" | "mermaid" | "json";

const exportTabs = [
  ["ddl", "DDL"],
  ["dml", "DML"],
  ["mermaid", "Mermaid"],
  ["json", "JSON"],
] as const satisfies ReadonlyArray<readonly [ExportTab, string]>;

/** A file the user keeps, so it is named after the diagram rather than "schema (3).json". */
const fileSlug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "schema";

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
    () => (isOpen && exportTab === "ddl" ? generateDDL(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const dml = useMemo(
    () => (isOpen && exportTab === "dml" ? generateDML(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const mermaid = useMemo(
    () => (isOpen && exportTab === "mermaid" ? generateMermaidER(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const json = useMemo(
    () => (isOpen && exportTab === "json" ? exportSchemaJson(schema) : ""),
    [exportTab, isOpen, schema],
  );
  const isJson = exportTab === "json";
  const isMermaid = exportTab === "mermaid";
  const output =
    exportTab === "ddl"
      ? ddl
      : exportTab === "dml"
        ? dml
        : exportTab === "mermaid"
          ? mermaid
          : json;

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([output], {
        type: isJson ? "application/json" : "text/plain",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = isJson
      ? `${fileSlug(schema.name)}.json`
      : isMermaid
        ? `${fileSlug(schema.name)}.mmd`
        : exportTab === "dml"
          ? "dml.sql"
          : "schema.sql";
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
        {/* A JSON or Mermaid export is a snapshot of the diagram, not generated Oracle SQL, so an Oracle DDL error does not block it. */}
        {errors.length > 0 && !isJson && !isMermaid && (
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
              <code>
                {isJson
                  ? highlightJson(output)
                  : isMermaid
                    ? highlightMermaid(output)
                    : highlightSql(output)}
              </code>
            </pre>
          </TabsContent>
        ))}
      </Tabs>
    </Dialog>
  );
};
