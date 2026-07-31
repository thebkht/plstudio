export const ORACLE_VERSION = "12.2+" as const;
export const SCHEMA_FORMAT_VERSION = 1 as const;

export const ORACLE_TYPES = [
  "VARCHAR2",
  "CHAR",
  "NCHAR",
  "NVARCHAR2",
  "NUMBER",
  "FLOAT",
  "BINARY_FLOAT",
  "BINARY_DOUBLE",
  "DATE",
  "TIMESTAMP",
  "TIMESTAMP WITH TIME ZONE",
  "TIMESTAMP WITH LOCAL TIME ZONE",
  "INTERVAL YEAR TO MONTH",
  "INTERVAL DAY TO SECOND",
  "CLOB",
  "NCLOB",
  "BLOB",
  "BFILE",
  "RAW",
] as const;

export type OracleType = (typeof ORACLE_TYPES)[number];
export type KeyStrategy = "none" | "sequence-trigger" | "identity";

export type ForeignKeyRef = { tableId: string; columnId: string };

export type Column = {
  id: string;
  name: string;
  type: OracleType;
  size: string;
  notNull: boolean;
  pk: boolean;
  unique: boolean;
  defaultValue: string;
  check: string;
  fk: ForeignKeyRef | null;
};

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: { a: string; b: string };
  keyStrategy: KeyStrategy;
  columns: Column[];
};

export type Schema = {
  id: string;
  name: string;
  revision: number;
  schemaFormatVersion: number;
  tables: Table[];
  updatedAt?: string;
};

export const PALETTE = [
  { a: "#5B8DEF", b: "#3A66C4" },
  { a: "#E8A33D", b: "#C27F1E" },
  { a: "#4FB286", b: "#2E8A63" },
  { a: "#C15FBB", b: "#9A3F94" },
  { a: "#E36B6B", b: "#BC4646" },
  { a: "#4FBEDA", b: "#2E93AD" },
  { a: "#A78BFA", b: "#7C5CE0" },
];

let sequence = 0;
export function nextId(prefix: string) {
  sequence += 1;
  return `${prefix}_${sequence}`;
}

export function makeColumn(partial: Partial<Column> = {}): Column {
  return {
    id: nextId("col"),
    name: "COLUMN_1",
    type: "VARCHAR2",
    size: "100",
    notNull: false,
    pk: false,
    unique: false,
    defaultValue: "",
    check: "",
    fk: null,
    ...partial,
  };
}

export function makeTable(name: string, x: number, y: number, colorIndex = 0): Table {
  return {
    id: nextId("tbl"),
    name,
    x,
    y,
    color: PALETTE[colorIndex % PALETTE.length],
    keyStrategy: "sequence-trigger",
    columns: [makeColumn({ name: "ID", type: "NUMBER", size: "", notNull: true, pk: true })],
  };
}

export function makeDemoSchema(): Schema {
  const student = makeTable("STUDENT", 80, 90, 0);
  const enrollment = makeTable("ENROLLMENT", 460, 270, 1);
  enrollment.columns = [
    makeColumn({ name: "STUDENT_ID", type: "NUMBER", size: "", notNull: true, fk: { tableId: student.id, columnId: student.columns[0].id } }),
    makeColumn({ name: "COURSE_CODE", type: "VARCHAR2", size: "20", notNull: true }),
    makeColumn({ name: "STATUS", type: "CHAR", size: "1", notNull: true, defaultValue: "'A'", check: "STATUS IN ('A', 'I')" }),
    makeColumn({ name: "ENROLLED_ON", type: "DATE", size: "", notNull: true, defaultValue: "SYSDATE" }),
  ];
  enrollment.keyStrategy = "none";
  return {
    id: nextId("schema"),
    name: "Oracle PL/SQL Workspace",
    revision: 1,
    schemaFormatVersion: SCHEMA_FORMAT_VERSION,
    tables: [student, enrollment],
  };
}

export function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_$#]/g, "_").replace(/^([0-9])/, "T_$1");
}

export function typeString(column: Column) {
  if (typeUsesSize(column.type) && column.size) return `${column.type}(${column.size})`;
  return column.type;
}

export function typeUsesSize(type: OracleType) {
  return ["VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2", "NUMBER", "FLOAT", "TIMESTAMP", "RAW"].includes(type);
}

export function typeSizePlaceholder(type: OracleType) {
  if (["NUMBER"].includes(type)) return "precision[,scale]";
  if (["TIMESTAMP"].includes(type)) return "precision 0–9";
  if (["FLOAT"].includes(type)) return "precision 1–126";
  return "size";
}

export function isNumeric(column: Column) {
  return column.type === "NUMBER";
}

export function primaryKeyColumns(table: Table) {
  return table.columns.filter((column) => column.pk);
}

export function tableHeight(table: Table) {
  return 38 + table.columns.length * 27;
}

export function cloneSchema(schema: Schema): Schema {
  return structuredClone(schema);
}
