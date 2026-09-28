"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { generateMigration } from "@/app/lib/migration";
import type { Schema } from "@/app/lib/schema";
import type { VersionMeta, VersionRecord } from "@/db/file-store";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { highlightSql } from "../../highlight";
import type { MigrationBaseline } from "./export";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * The project's saved versions. Every save is one (unchanged saves collapse
 * into the version before them), and any of them can be named, which also
 * keeps it from being pruned.
 *
 * Selecting a version shows what has changed since, as the migration script
 * that would take a database built from it to the diagram as it is now -- the
 * same diff Export → Migration produces, and one click from being it.
 */
export function HistoryModal({
  isOpen,
  onOpenChange,
  projectId,
  workspaceSlug,
  shareToken,
  readOnly,
  schema,
  onSave,
  onRestore,
  onUseAsBaseline,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  workspaceSlug?: string;
  shareToken?: string;
  readOnly: boolean;
  schema: Schema;
  /** The save pipeline: a named version snapshots what is stored, so it saves first. */
  onSave: () => Promise<void> | void;
  onRestore: (schema: Schema) => void;
  onUseAsBaseline: (baseline: MigrationBaseline) => void;
}) {
  const [versions, setVersions] = useState<VersionMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<VersionRecord | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  /** Versions never change once written (bar the label), so each is fetched once. */
  const cacheRef = useRef(new Map<string, VersionRecord>());

  const url = (path = "") => {
    const query = new URLSearchParams();
    if (workspaceSlug) query.set("workspace", workspaceSlug);
    if (shareToken) query.set("shareToken", shareToken);
    return `/api/projects/${encodeURIComponent(projectId)}/versions${path}${query.size ? `?${query}` : ""}`;
  };

  const load = async () => {
    setError(null);
    const response = await fetch(url()).catch(() => null);
    if (!response?.ok) {
      setError("Version history is unavailable.");
      return;
    }
    const { versions: list } = (await response.json()) as { versions: VersionMeta[] };
    setVersions(list);
    setSelectedId((current) => (current && list.some((version) => version.id === current) ? current : (list[0]?.id ?? null)));
  };

  useEffect(() => {
    if (isOpen) void load();
    // `load` reads only props that identify the project; reopening is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const cached = cacheRef.current.get(selectedId);
    if (cached) {
      setSelected(cached);
      return;
    }
    let live = true;
    setSelected(null);
    void fetch(url(`/${encodeURIComponent(selectedId)}`))
      .then((response) => (response.ok ? (response.json() as Promise<VersionRecord>) : null))
      .catch(() => null)
      .then((record) => {
        if (!live) return;
        if (!record) {
          setError("That version could not be read.");
          return;
        }
        cacheRef.current.set(record.id, record);
        setSelected(record);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const meta = versions?.find((version) => version.id === selectedId) ?? null;
  const changes = useMemo(
    () => (isOpen && selected ? generateMigration(selected.schemaJson, schema) : null),
    [isOpen, schema, selected],
  );
  const title = (version: Pick<VersionMeta, "revision" | "label">) =>
    version.label || `Revision ${version.revision}`;

  const saveNamed = async () => {
    setBusy(true);
    try {
      await onSave();
      const response = await fetch(url(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!response.ok) throw new Error();
      const saved = (await response.json()) as VersionMeta;
      setLabel("");
      cacheRef.current.delete(saved.id);
      await load();
      setSelectedId(saved.id);
      toast.success(`Saved as “${title(saved)}”.`);
    } catch {
      toast.error("Could not save a version.");
    } finally {
      setBusy(false);
    }
  };

  const rename = async (version: VersionMeta, next: string) => {
    if ((version.label ?? "") === next.trim()) return;
    const response = await fetch(url(`/${encodeURIComponent(version.id)}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: next }),
    }).catch(() => null);
    if (!response?.ok) {
      toast.error("Could not rename the version.");
      return;
    }
    const updated = (await response.json()) as VersionMeta;
    setVersions((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? list);
    const cached = cacheRef.current.get(updated.id);
    if (cached) cacheRef.current.set(updated.id, { ...cached, label: updated.label });
  };

  const restore = () => {
    if (!selected || !meta) return;
    onRestore(selected.schemaJson);
    onOpenChange(false);
    toast.success(`Restored “${title(meta)}”.`, {
      description: "Undo brings the diagram back. Save to keep the restore.",
    });
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} className="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Version history</DialogTitle>
        <DialogDescription>
          Every save is kept, up to the last 100. Named versions are kept for good.
        </DialogDescription>
      </DialogHeader>
      {!readOnly && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void saveNamed();
          }}
        >
          <Input
            aria-label="Version name"
            placeholder="Name this version, e.g. Release 1.4"
            value={label}
            maxLength={80}
            onChange={(event) => setLabel(event.target.value)}
          />
          <Button type="submit" isDisabled={busy || !label.trim()}>
            {busy ? "Saving…" : "Save version"}
          </Button>
        </form>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}
      <div className="history-layout">
        <ol className="history-list" aria-label="Versions">
          {versions?.length === 0 && (
            <li className="history-empty">Nothing saved yet. Save the project to start its history.</li>
          )}
          {versions?.map((version) => (
            <li key={version.id}>
              <button
                type="button"
                className="history-item"
                aria-current={version.id === selectedId ? "true" : undefined}
                onClick={() => setSelectedId(version.id)}
              >
                <span className="history-item-title">
                  {title(version)}
                  {version.label && <Badge variant="secondary">r{version.revision}</Badge>}
                </span>
                <span className="history-item-meta">
                  {when.format(new Date(version.createdAt))} · {version.tables} table{version.tables === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <section className="history-detail" aria-label="Selected version">
          {meta && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  key={meta.id}
                  aria-label="Rename this version"
                  className="max-w-64"
                  placeholder={`Revision ${meta.revision}`}
                  defaultValue={meta.label ?? ""}
                  maxLength={80}
                  disabled={readOnly}
                  onBlur={(event) => void rename(meta, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <div className="ml-auto flex gap-2">
                  <Button
                    variant="outline"
                    isDisabled={!selected}
                    onClick={() => {
                      if (!selected) return;
                      onUseAsBaseline({ schema: selected.schemaJson, label: title(meta), warnings: [] });
                    }}
                  >
                    Migration from here
                  </Button>
                  <Button isDisabled={!selected || readOnly} onClick={restore}>
                    Restore
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {!changes
                  ? "Loading…"
                  : changes.statements
                    ? `${changes.statements} change${changes.statements === 1 ? "" : "s"} since this version:`
                    : "The diagram has not changed since this version."}
              </p>
              {changes?.sql && (
                <pre className="code history-diff">
                  <code>{highlightSql(changes.sql)}</code>
                </pre>
              )}
            </>
          )}
        </section>
      </div>
    </Dialog>
  );
}
