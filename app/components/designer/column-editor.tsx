"use client";

import { memo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, FingerPrintIcon, Key01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColumnFlag } from "./primitives";
import { ORACLE_TYPES, type Column, type Table, typeUsesSize, typeSizePlaceholder } from "@/app/lib/schema";

const NO_REFERENCE = "__no_reference__";
type ForeignKeyTarget = { table: Table; target: Column };

export const ColumnEditor = memo(function ColumnEditor({
  table,
  column,
  patchColumn,
  deleteColumn,
  compatibleForeignKeyTargets,
}: {
  table: Table;
  column: Column;
  patchColumn: (tableId: string, columnId: string, patch: Partial<Column>) => void;
  deleteColumn: (tableId: string, columnId: string) => void;
  compatibleForeignKeyTargets: (column: Column) => ForeignKeyTarget[];
}) {
  const patch = (changes: Partial<Column>) => patchColumn(table.id, column.id, changes);
  return (
    <div className="column-card">
      <InputGroup>
        <InputGroupInput
          aria-label={`Name of column ${column.name}`}
          value={column.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={`Delete column ${column.name}`}
            onClick={() => deleteColumn(table.id, column.id)}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <div className="column-card-row">
        <Select
          className="w-full"
          aria-label={`Datatype for ${column.name}`}
          selectedKey={column.type}
          onSelectionChange={(key) => patch({ type: key as Column["type"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            {ORACLE_TYPES.map((type) => <SelectItem key={type} id={type}>{type}</SelectItem>)}
          </SelectGroup></SelectContent>
        </Select>
        {typeUsesSize(column.type) && (
          <Input
            aria-label={`Size for ${column.name}`}
            placeholder={typeSizePlaceholder(column.type)}
            value={column.size}
            onChange={(event) => patch({ size: event.target.value })}
          />
        )}
      </div>
      <FieldSet>
        <FieldLegend variant="label" className="sr-only">Constraints for {column.name}</FieldLegend>
        <div className="column-flags">
          <ColumnFlag
            label="Primary key"
            icon={Key01Icon}
            isSelected={column.pk}
            onChange={(isSelected) => patch({ pk: isSelected, fk: isSelected ? null : column.fk })}
          />
          <ColumnFlag
            label="Nullable"
            glyph="?"
            isSelected={!column.notNull}
            onChange={(isSelected) => patch({ notNull: !isSelected })}
          />
          <ColumnFlag
            label="Unique"
            icon={FingerPrintIcon}
            isSelected={column.unique}
            onChange={(isSelected) => patch({ unique: isSelected })}
          />
        </div>
      </FieldSet>
      <Input aria-label={`Default for ${column.name}`} placeholder="DEFAULT expression" value={column.defaultValue} onChange={(event) => patch({ defaultValue: event.target.value })} />
      <Input aria-label={`Check for ${column.name}`} placeholder="CHECK expression" value={column.check} onChange={(event) => patch({ check: event.target.value })} />
      <Input aria-label={`Comment for ${column.name}`} placeholder="COLUMN COMMENT" value={column.comment ?? ""} onChange={(event) => patch({ comment: event.target.value })} />
      {!column.pk && (
        <Select
          className="w-full"
          aria-label={`Foreign key for ${column.name}`}
          selectedKey={column.fk ? `${column.fk.tableId}::${column.fk.columnId}` : NO_REFERENCE}
          onSelectionChange={(key) => {
            const [tableId, columnId] = String(key).split("::");
            patch({ fk: tableId && columnId ? { tableId, columnId } : null });
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>
            <SelectItem id={NO_REFERENCE}>No reference</SelectItem>
            {compatibleForeignKeyTargets(column).map(({ table: target, target: field }) => (
              <SelectItem key={`${target.id}::${field.id}`} id={`${target.id}::${field.id}`}>
                {target.name.toUpperCase()}.{field.name.toUpperCase()}
              </SelectItem>
            ))}
          </SelectGroup></SelectContent>
        </Select>
      )}
    </div>
  );
});
