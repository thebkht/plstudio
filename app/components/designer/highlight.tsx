import type { ReactNode } from "react";

/**
 * Syntax colouring for the read-only `pre.code` blocks and for the layer that
 * sits under the import textarea (`.sql-input` paints its own text
 * transparent, so that layer is the only thing the user actually sees).
 *
 * Both languages share one token walk and one set of `.sql-token` classes --
 * `keyword`, `string`, `number`, `comment` -- so a colour is defined once in
 * `globals.css` no matter what is being read.
 */
const SQL_TOKEN =
  /(--[^\n]*|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|ALTER|DROP|TABLE|COLUMN|SEQUENCE|TRIGGER|OR|REPLACE|BEFORE|AFTER|INSERTING|UPDATING|DELETING|ON|FOR|EACH|ROW|BEGIN|END|IF|THEN|ELSE|NULL|NOT|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|UNIQUE|CHECK|DEFAULT|AS|IS|AND|NUMBER|VARCHAR2|CHAR|DATE|TIMESTAMP|CLOB|BLOB|RAW|IDENTITY|GENERATED|ALWAYS|BY|COMMIT|RETURNING|PACKAGE|BODY|FUNCTION|PROCEDURE|OPEN|CURSOR)\b)/gi;

/** A property name keeps its colon, which is what separates it from a plain string value. */
const JSON_TOKEN = /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b)/g;

/**
 * One `<span>` per token, so a large enough document is a large enough number
 * of DOM nodes to stall the dialog. Past this it renders unstyled instead.
 */
const MAX_HIGHLIGHTED = 200_000;

function highlight(source: string, pattern: RegExp, kindOf: (token: string) => string): ReactNode[] {
  if (source.length > MAX_HIGHLIGHTED) return [source];
  const pieces: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((match = pattern.exec(source))) {
    if (match.index > cursor) pieces.push(source.slice(cursor, match.index));
    const token = match[0];
    pieces.push(
      <span className={`sql-token ${kindOf(token)}`} key={`${match.index}-${token}`}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }
  if (cursor < source.length) pieces.push(source.slice(cursor));
  return pieces;
}

export function highlightSql(source: string): ReactNode[] {
  return highlight(source, SQL_TOKEN, (token) =>
    token.startsWith("--") ? "comment" : token.startsWith("'") ? "string" : /^\d/.test(token) ? "number" : "keyword",
  );
}

export function highlightJson(source: string): ReactNode[] {
  return highlight(source, JSON_TOKEN, (token) =>
    token.endsWith(":") ? "keyword" : token.startsWith('"') ? "string" : "number",
  );
}

const MERMAID_TOKEN =
  /(%%[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\|[o|]--[|o]\{|\}o--\|\||\|\|--\|\||\|\|--o\{|\|\|--\|\{|\|[o|]\.\.[|o]\{|\}o\.\.\|\||\|\|\.\.\|\||\|\|\.\.o\{|\|\|\.\.\|\{|--|\.\.|\b(?:erDiagram|title|accTitle|accDescr|PK|FK|UK|NN|NOT|NULL|PRIMARY|KEY|FOREIGN|UNIQUE|NUMBER|VARCHAR2|VARCHAR|CHAR|NCHAR|NVARCHAR2|DATE|TIMESTAMP|CLOB|BLOB|RAW|FLOAT|DOUBLE|BINARY|UUID|STRING|BOOLEAN|INTEGER|INT|BIGINT|DECIMAL|NUMERIC|TEXT)\b)/gi;

export function highlightMermaid(source: string): ReactNode[] {
  return highlight(source, MERMAID_TOKEN, (token) =>
    token.startsWith("%%")
      ? "comment"
      : token.startsWith('"') || token.startsWith("'")
        ? "string"
        : /^\d/.test(token)
          ? "number"
          : "keyword",
  );
}
