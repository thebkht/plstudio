"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ColumnInsertIcon, FileUploadIcon } from "@hugeicons/core-free-icons";
import { generateDDL } from "@/app/lib/generators";
import type { Schema } from "@/app/lib/schema";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { highlightSql } from "./highlight";

export type ImportMessage = { ok: boolean; text: string };

/**
 * The text the user is importing is the only state here; parsing and
 * committing it stay with the designer, which owns the schema.
 */
export const ImportModal = ({
  isOpen,
  onOpenChange,
  schema,
  message,
  onReplace,
  onAppend,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
  message: ImportMessage | null;
  onReplace: (text: string) => void;
  onAppend: (text: string) => void;
}) => {
  const [importText, setImportText] = useState("");
  const highlightRef = useRef<HTMLPreElement>(null);

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-3xl"
    >
      <DialogHeader>
        <DialogTitle>Import Oracle DDL</DialogTitle>
        <DialogDescription>
          Supported CREATE TABLE subset · all-or-nothing · add to this project
          or replace it
        </DialogDescription>
      </DialogHeader>
      <div className="sql-editor">
        <pre ref={highlightRef} className="sql-highlight" aria-hidden="true">
          <code>{highlightSql(importText)}</code>
        </pre>
        <Textarea
          aria-label="Oracle DDL input"
          className="sql-input"
          placeholder="CREATE TABLE STUDENT ( ID NUMBER NOT NULL, NAME VARCHAR2(100), CONSTRAINT PK_STUDENT PRIMARY KEY (ID) );"
          value={importText}
          onScroll={(event) => {
            if (highlightRef.current) {
              highlightRef.current.scrollTop = event.currentTarget.scrollTop;
              highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
          onChange={(event) => setImportText(event.target.value)}
        />
      </div>
      {message && (
        <Alert variant={message.ok ? "default" : "destructive"}>
          <AlertTitle>{message.text}</AlertTitle>
        </Alert>
      )}
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setImportText(generateDDL(schema))}
        >
          Use current export
        </Button>
        <Button variant="outline" onClick={() => onReplace(importText)}>
          <HugeiconsIcon icon={FileUploadIcon} data-icon="inline-start" />
          Replace project
        </Button>
        <Button onClick={() => onAppend(importText)}>
          <HugeiconsIcon icon={ColumnInsertIcon} data-icon="inline-start" />
          Add tables to project
        </Button>
      </DialogFooter>
    </Dialog>
  );
};
