"use client";

import { useState } from "react";
import type { Schema } from "@/app/lib/schema";
import type { ValidationIssue } from "@/app/lib/validation";
import { useLayout, useSchema } from "@/app/hooks";
import { ExportModal, type ExportTab, type MigrationBaseline } from "./export";
import {
  ImportModal,
  type ImportFormat,
  type ImportMessage,
} from "./import";
import { ShareModal } from "./share";
import { ShortcutsModal } from "./shortcuts";

export type ModalsProps = {
  projectId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  readOnly: boolean;
  importMessage: ImportMessage | null;
  onImportMessage: (message: ImportMessage | null) => void;
  onReplace: (text: string, format: ImportFormat) => void;
  onAppend: (text: string, format: ImportFormat) => void;
  onClearInvalidForeignKeys: () => void;
};

/**
 * One place that maps the open-modal value to a body, the way drawdb's
 * `Modal.jsx` switches on its MODAL enum. The union in `LayoutContext` plays
 * the part of that enum, so every modal is closed by the same `setModal(null)`.
 */
export function Modals({
  projectId,
  workspaceSlug,
  workspaceId,
  readOnly,
  importMessage,
  onImportMessage,
  onReplace,
  onAppend,
  onClearInvalidForeignKeys,
}: ModalsProps) {
  const { modal, setModal } = useLayout();
  const { schema, errors } = useSchema();
  const close = (open: boolean) => !open && setModal(null);
  const [exportTab, setExportTab] = useState<ExportTab>("ddl");
  // Kept across openings: comparing against the same baseline is the common case.
  const [baseline, setBaseline] = useState<MigrationBaseline | null>(null);

  return (
    <>
      <ShareModal
        isOpen={modal === "share"}
        onOpenChange={close}
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceId}
      />
      <ExportModal
        isOpen={modal === "export"}
        onOpenChange={close}
        schema={schema as Schema}
        errors={errors as ValidationIssue[]}
        onClearInvalidForeignKeys={onClearInvalidForeignKeys}
        exportTab={exportTab}
        onExportTabChange={setExportTab}
        baseline={baseline}
        onBaselineChange={setBaseline}
      />
      <ImportModal
        isOpen={modal === "import"}
        onOpenChange={close}
        schema={schema}
        readOnly={readOnly}
        message={importMessage}
        onMessage={onImportMessage}
        onReplace={onReplace}
        onAppend={onAppend}
      />
      <ShortcutsModal
        isOpen={modal === "shortcuts"}
        onOpenChange={close}
        readOnly={readOnly}
      />
    </>
  );
}
