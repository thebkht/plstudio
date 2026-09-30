"use client";

/**
 * A relationship's editor, as inset grouped lists -- the same structure the
 * table editor is built from, so the two halves of the side panel read alike.
 *
 * Label on the left, value on the right, one property per row; the rows fall
 * into three groups by what they change (the link itself, what the database
 * does on a write, which columns it joins), and the destructive action sits
 * alone at the bottom, where it cannot be pressed on the way to anything else.
 */

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDataTransferHorizontalIcon, ArrowRight02Icon, Delete02Icon, MinusSignCircleIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RELATIONSHIP_CONSTRAINTS, type Cardinality, type Relationship, type Table } from "@/app/lib/schema";

type FieldPair = Relationship["fields"][number];

const CARDINALITIES: [Cardinality, string][] = [
  ["many_to_one", "Many to one"],
  ["one_to_many", "One to many"],
  ["one_to_one", "One to one"],
];

export function RelationshipDetail({
  relationship,
  startTable,
  endTable,
  readOnly,
  onPatch,
  onSwap,
  onDelete,
}: {
  relationship: Relationship;
  startTable?: Table;
  endTable?: Table;
  readOnly: boolean;
  onPatch: (patch: Partial<Relationship>) => void;
  onSwap: () => void;
  onDelete: () => void;
}) {
  const pairs: FieldPair[] = relationship.fields.length ? relationship.fields : [{ startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId }];
  const setPair = (index: number, patch: Partial<FieldPair>) => onPatch({ fields: pairs.map((pair, at) => (at === index ? { ...pair, ...patch } : pair)) });
  const canAddPair = !readOnly && pairs.length < Math.min(startTable?.columns.length ?? 0, endTable?.columns.length ?? 0);
  const addPair = () => {
    const start = startTable?.columns.find((column) => !pairs.some((pair) => pair.startFieldId === column.id));
    const end = endTable?.columns.find((column) => !pairs.some((pair) => pair.endFieldId === column.id));
    if (start && end) onPatch({ fields: [...pairs, { startFieldId: start.id, endFieldId: end.id }] });
  };
  const startName = startTable?.name.toUpperCase() ?? "—";
  const endName = endTable?.name.toUpperCase() ?? "—";

  return (
    <div className="relationship-detail">
      <div className="inset-group">
        <label className="inset-row">
          <span className="inset-row-label">Name</span>
          <Input className="inset-field mono" disabled={readOnly} value={relationship.name} onChange={(event) => onPatch({ name: event.target.value })} />
        </label>
        {/* Read as a sentence -- this table points at that one -- rather than
            two captioned columns with a button wedged between them. */}
        <div className="inset-row">
          <span className="inset-row-label">Tables</span>
          <span className="inset-row-value relationship-tables" title={`${startName} references ${endName}`}>
            <span className="relationship-table">{startName}</span>
            <HugeiconsIcon icon={ArrowRight02Icon} size={13} className="relationship-tables-arrow" aria-label="references" />
            <span className="relationship-table">{endName}</span>
          </span>
          {!readOnly && (
            <button type="button" className="row-icon-button tint" aria-label="Swap which table holds the foreign key" title="Swap direction" onClick={onSwap}>
              <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} size={15} />
            </button>
          )}
        </div>
        <div className="inset-row">
          <span className="inset-row-label">Cardinality</span>
          <Select className="inset-row-value" aria-label="Cardinality" isDisabled={readOnly} selectedKey={relationship.cardinality} onSelectionChange={(key) => onPatch({ cardinality: key as Cardinality })}>
            <SelectTrigger className="inset-field"><SelectValue /></SelectTrigger>
            <SelectContent><SelectGroup>
              {CARDINALITIES.map(([id, label]) => <SelectItem key={id} id={id}>{label}</SelectItem>)}
            </SelectGroup></SelectContent>
          </Select>
        </div>
        {relationship.cardinality !== "one_to_one" && (
          <label className="inset-row">
            <span className="inset-row-label">Many label</span>
            <Input className="inset-field mono" disabled={readOnly} placeholder="n" value={relationship.manyLabel} onChange={(event) => onPatch({ manyLabel: event.target.value })} />
          </label>
        )}
      </div>

      <section className="inset-section" aria-label="Referential actions">
        <h3 className="inset-group-header">Referential actions</h3>
        <div className="inset-group">
          {([["updateConstraint", "On update"], ["deleteConstraint", "On delete"]] as const).map(([key, label]) => (
            <div className="inset-row" key={key}>
              <span className="inset-row-label">{label}</span>
              <Select className="inset-row-value" aria-label={label} isDisabled={readOnly} selectedKey={relationship[key]} onSelectionChange={(value) => onPatch({ [key]: value as Relationship[typeof key] })}>
                <SelectTrigger className="inset-field"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>
                  {RELATIONSHIP_CONSTRAINTS.map((constraint) => <SelectItem key={constraint} id={constraint}>{constraint}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </section>

      <section className="inset-section" aria-label="Joined columns">
        <h3 className="inset-group-header">
          Columns
          {pairs.length > 1 && <span className="inset-group-count">{pairs.length}</span>}
          {canAddPair && (
            <button type="button" className="row-icon-button tint" aria-label="Add a column pair" onClick={addPair}>
              <HugeiconsIcon icon={PlusSignIcon} size={16} />
            </button>
          )}
        </h3>
        <div className="inset-group">
          {pairs.map((pair, index) => (
            <div className="inset-row relationship-pair" key={`${pair.startFieldId}-${pair.endFieldId}-${index}`}>
              {pairs.length > 1 && !readOnly && (
                <button type="button" className="row-icon-button destructive" aria-label={`Remove column pair ${index + 1}`} onClick={() => onPatch({ fields: pairs.filter((_, at) => at !== index) })}>
                  <HugeiconsIcon icon={MinusSignCircleIcon} size={15} />
                </button>
              )}
              <Select className="relationship-pair-side" aria-label={`Column in ${startName}`} isDisabled={readOnly} selectedKey={pair.startFieldId} onSelectionChange={(key) => setPair(index, { startFieldId: String(key) })}>
                <SelectTrigger className="inset-field mono leading"><SelectValue /></SelectTrigger>
                <SelectContent className="code-menu"><SelectGroup>
                  {startTable?.columns.map((column) => <SelectItem key={column.id} id={column.id}>{column.name.toUpperCase()}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
              <HugeiconsIcon icon={ArrowRight02Icon} size={13} className="relationship-tables-arrow" aria-hidden="true" />
              <Select className="relationship-pair-side" aria-label={`Column in ${endName}`} isDisabled={readOnly} selectedKey={pair.endFieldId} onSelectionChange={(key) => setPair(index, { endFieldId: String(key) })}>
                <SelectTrigger className="inset-field mono"><SelectValue /></SelectTrigger>
                <SelectContent className="code-menu"><SelectGroup>
                  {endTable?.columns.map((column) => <SelectItem key={column.id} id={column.id}>{column.name.toUpperCase()}</SelectItem>)}
                </SelectGroup></SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="inset-group-footer">Each row joins a column of {startName} to the column of {endName} it references.</p>
      </section>

      {!readOnly && (
        <div className="inset-group">
          <button type="button" className="inset-row inset-row-action destructive relationship-delete" onClick={onDelete}>
            <HugeiconsIcon icon={Delete02Icon} size={15} aria-hidden="true" />
            Delete relationship
          </button>
        </div>
      )}
    </div>
  );
}
