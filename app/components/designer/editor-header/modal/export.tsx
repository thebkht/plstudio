"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Copy01Icon,
  Download04Icon,
  FolderOpenIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { generateDDL, generateDML, generateMermaidER } from "@/app/lib/generators";
import { generateMigration } from "@/app/lib/migration";
import { parseCreateTable } from "@/app/lib/parser";
import { exportSchemaJson, parseSchemaJson } from "@/app/lib/schema-json";
import type { Schema } from "@/app/lib/schema";
import type { ValidationIssue } from "@/app/lib/validation";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { highlightJson, highlightMermaid, highlightSql } from "../../highlight";

export type ExportTab = "ddl" | "dml" | "migration" | "mermaid" | "json";

/**
 * What a migration is generated *from*: the database as it stands, which the
 * diagram cannot know. It comes from a file (a JSON export or the DDL it was
 * built with) or from a saved version.
 */
export type MigrationBaseline = { schema: Schema; label: string; warnings: string[] };

const exportTabs = [
  ["ddl", "DDL"],
  ["dml", "DML"],
  ["migration", "Migration"],
  ["mermaid", "Mermaid"],
  ["json", "JSON"],
] as const satisfies ReadonlyArray<readonly [ExportTab, string]>;

/** `file.text()` resolves eagerly, so a huge file would freeze the tab first. */
const MAX_BASELINE_BYTES = 5_000_000;

/** A file the user keeps, so it is named after the diagram rather than "schema (3).json". */
const fileSlug = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "schema";

export const ExportModal = ({
  isOpen,
  onOpenChange,
  schema,
  errors,
  onClearInvalidForeignKeys,
  exportTab,
  onExportTabChange: setExportTab,
  baseline,
  onBaselineChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
  errors: ValidationIssue[];
  onClearInvalidForeignKeys: () => void;
  /** Lifted, so Version history can open this straight onto a migration. */
  exportTab: ExportTab;
  onExportTabChange: (tab: ExportTab) => void;
  baseline: MigrationBaseline | null;
  onBaselineChange: (baseline: MigrationBaseline | null) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
  const migration = useMemo(
    () => (isOpen && exportTab === "migration" && baseline ? generateMigration(baseline.schema, schema) : null),
    [baseline, exportTab, isOpen, schema],
  );
  const isJson = exportTab === "json";
  const isMigration = exportTab === "migration";
  const isMermaid = exportTab === "mermaid";
  const output =
    exportTab === "ddl"
      ? ddl
      : exportTab === "dml"
        ? dml
        : exportTab === "mermaid"
          ? mermaid
          : isMigration
            ? (migration?.sql ?? "")
            : json;

  const openBaseline = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared first, or picking the same file twice in a row fires no change event.
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BASELINE_BYTES) {
      setBaselineError(`${file.name} is too large (max 5 MB).`);
      return;
    }
    const text = await file.text();
    const parsed = text.trimStart().startsWith("{") ? parseSchemaJson(text) : parseCreateTable(text);
    if (!parsed.schema || parsed.errors.length) {
      setBaselineError(parsed.errors[0] ?? `${file.name} holds no tables.`);
      return;
    }
    setBaselineError(null);
    onBaselineChange({ schema: parsed.schema, label: file.name, warnings: parsed.warnings });
  };
  const reviewNotes = [...(baseline?.warnings ?? []), ...(migration?.warnings ?? [])];

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
        : isMigration
          ? `${fileSlug(schema.name)}-migration.sql`
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
            <Button variant="ghost" size="icon" aria-label="Copy export" isDisabled={!output} onClick={copyOutput}>
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Download export" isDisabled={!output} onClick={download}>
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
        <TabsContent id="migration">
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {baseline ? (
                <>
                  From <span className="font-medium text-foreground">{baseline.label}</span> to this diagram
                  {migration ? ` · ${migration.statements} statement${migration.statements === 1 ? "" : "s"}` : ""}
                </>
              ) : (
                "Load the database as it is now (its JSON export or the DDL it was built with), or pick a saved version from Version history."
              )}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.sql,.ddl,.mmd,.mermaid,application/json,text/plain"
              className="sr-only"
              aria-label="Baseline schema file"
              onChange={openBaseline}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <HugeiconsIcon icon={FolderOpenIcon} data-icon="inline-start" />
              {baseline ? "Change baseline" : "Load baseline"}
            </Button>
          </div>
          {baselineError && (
            <Alert variant="destructive" className="mt-3">
              <HugeiconsIcon icon={Cancel01Icon} />
              <AlertTitle>{baselineError}</AlertTitle>
            </Alert>
          )}
          {/* Parse warnings first: a constraint the baseline skipped shows up below as one to add. */}
          {reviewNotes.length > 0 && (
            <Alert className="mt-3">
              <AlertTitle>Review before running</AlertTitle>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {reviewNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </Alert>
          )}
          {baseline && (
            <pre className="code mt-3">
              <code>{migration?.sql ? highlightSql(migration.sql) : "-- No changes: the diagram matches the baseline."}</code>
            </pre>
          )}
        </TabsContent>
        {exportTabs.filter(([key]) => key !== "migration").map(([key]) => (
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
