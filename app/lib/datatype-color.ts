/**
 * Datatype categories drive the colour of the type label on a table card, so a
 * schema can be read at a glance without reading the words.
 *
 * The category split and hues follow drawDB's convention (Tailwind 500-series).
 */

import type { OracleType } from "./schema";

export type TypeCategory =
  | "string"
  | "integer"
  | "decimal"
  | "date"
  | "binary"
  | "other";

const CATEGORIES: Record<TypeCategory, readonly string[]> = {
  string: ["VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2", "CLOB", "NCLOB"],
  integer: ["NUMBER"],
  decimal: ["FLOAT", "BINARY_FLOAT", "BINARY_DOUBLE"],
  date: [
    "DATE",
    "TIMESTAMP",
    "TIMESTAMP WITH TIME ZONE",
    "TIMESTAMP WITH LOCAL TIME ZONE",
    "INTERVAL YEAR TO MONTH",
    "INTERVAL DAY TO SECOND",
  ],
  binary: ["BLOB", "BFILE", "RAW"],
  other: [],
};

export function categoryOf(type: OracleType | string): TypeCategory {
  const entry = (Object.entries(CATEGORIES) as [TypeCategory, readonly string[]][]).find(
    ([, types]) => types.includes(type),
  );
  return entry ? entry[0] : "other";
}

/** CSS custom property holding the colour for a datatype's category. */
export function typeColorVar(type: OracleType | string) {
  return `var(--type-${categoryOf(type)})`;
}
