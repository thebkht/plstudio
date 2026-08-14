import {
  APPEND_GAP,
  contentEdges,
  GROUP_COLORS,
  makeColumn,
  makeSchemaGroup,
  makeTable,
  nextId,
  normalizeIdentifier,
  normalizeRelationships,
  PALETTE,
  primaryKeyColumns,
  SCHEMA_FORMAT_VERSION,
  tableHeight,
  tableWidth,
  TABLE_WIDTH,
  type Column,
  type ForeignKeyRef,
  type GroupColor,
  type OracleType,
  type Relationship,
  type Schema,
  type SchemaGroup,
  type Table,
} from "./schema";
import type { AppendResult, ParseOptions, ParseResult } from "./parser";

function bareName(value: string) {
  const parts = value.match(/"[^"]*"|\[[^\]]*\]|[A-Za-z0-9_$#-]+/g) ?? [];
  const last = parts[parts.length - 1] ?? value.trim();
  if (last.startsWith('"') && last.endsWith('"')) return last.slice(1, -1).trim();
  if (last.startsWith("[") && last.endsWith("]")) return last.slice(1, -1).trim();
  return last.trim();
}

function unescapeString(value: string) {
  return value.replace(/\\"/g, '"').replace(/\\'/g, "'").trim();
}

/** Check if the input looks like a Mermaid ER diagram. */
export function isMermaidER(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const stripped = text.replace(/%%[^\n]*/g, "").trim();
  if (/^\s*erDiagram\b/i.test(stripped)) return true;
  if (/erDiagram\b/i.test(text)) return true;
  // Fallback: has Mermaid entity block syntax and relationship arrows
  const hasEntity = /[A-Za-z0-9_$#]+\s*\{[^}]*\}/.test(stripped);
  const hasRelationship = /\|[o|]--[|o]\{|\}o--\|\||\|\|--\|\||\|\|--o\{|\|\|--\|\{/.test(stripped);
  return hasEntity && hasRelationship;
}

/** Normalize data types to Oracle types supported by DrawSQL / PLStudio. */
export function normalizeOracleType(rawType: string): { type: OracleType; size: string } {
  let clean = rawType.trim();

  // Extract size/precision from `(size)`, `~size~`, or `-size`
  let size = "";
  const parenMatch = clean.match(/\(([^)]*)\)/);
  const tildeMatch = clean.match(/~([^~]*)~/);
  const dashMatch = clean.match(/-(\d+(?:,\s*\d+)?)$/);

  if (parenMatch) {
    size = parenMatch[1].replace(/\s*(?:BYTE|CHAR)\s*$/i, "").replace(/\s+/g, "");
    clean = clean.replace(/\([^)]*\)/, "").trim();
  } else if (tildeMatch) {
    size = tildeMatch[1].replace(/\s+/g, "");
    clean = clean.replace(/~[^~]*~/, "").trim();
  } else if (dashMatch) {
    size = dashMatch[1].replace(/\s+/g, "");
    clean = clean.replace(/-(\d+(?:,\s*\d+)?)$/, "").trim();
  }

  const upper = clean.toUpperCase().replace(/[_\s]+/g, " ");

  // Multi-word timestamps & intervals
  if (upper.includes("WITH LOCAL TIME ZONE") || upper.includes("WITH LOCAL TIMEZONE")) {
    return { type: "TIMESTAMP WITH LOCAL TIME ZONE", size: "" };
  }
  if (upper.includes("WITH TIME ZONE") || upper.includes("WITH TIMEZONE") || upper === "TIMESTAMPTZ") {
    return { type: "TIMESTAMP WITH TIME ZONE", size: "" };
  }
  if (upper.includes("YEAR TO MONTH")) {
    return { type: "INTERVAL YEAR TO MONTH", size: "" };
  }
  if (upper.includes("DAY TO SECOND")) {
    return { type: "INTERVAL DAY TO SECOND", size: "" };
  }

  // Base types mapping
  if (upper === "VARCHAR2" || upper === "VARCHAR" || upper === "STRING") {
    return { type: "VARCHAR2", size: size || "100" };
  }
  if (upper === "NVARCHAR2" || upper === "NVARCHAR") {
    return { type: "NVARCHAR2", size: size || "100" };
  }
  if (upper === "CHAR") {
    return { type: "CHAR", size: size || "1" };
  }
  if (upper === "NCHAR") {
    return { type: "NCHAR", size: size || "1" };
  }
  if (upper === "BOOLEAN" || upper === "BOOL" || upper === "BIT") {
    return { type: "CHAR", size: "1" };
  }
  if (
    upper === "NUMBER" ||
    upper === "NUMERIC" ||
    upper === "DECIMAL" ||
    upper === "DEC" ||
    upper === "INT" ||
    upper === "INTEGER" ||
    upper === "BIGINT" ||
    upper === "SMALLINT" ||
    upper === "TINYINT" ||
    upper === "SERIAL" ||
    upper === "BIGSERIAL" ||
    upper === "MONEY"
  ) {
    return { type: "NUMBER", size };
  }
  if (upper === "FLOAT" || upper === "REAL") {
    return { type: "FLOAT", size };
  }
  if (upper === "BINARY_DOUBLE" || upper === "BINARY DOUBLE" || upper === "DOUBLE" || upper === "DOUBLE PRECISION") {
    return { type: "BINARY_DOUBLE", size: "" };
  }
  if (upper === "BINARY_FLOAT" || upper === "BINARY FLOAT") {
    return { type: "BINARY_FLOAT", size: "" };
  }
  if (upper === "DATE") {
    return { type: "DATE", size: "" };
  }
  if (upper === "TIMESTAMP" || upper === "DATETIME" || upper === "TIME") {
    return { type: "TIMESTAMP", size };
  }
  if (upper === "CLOB" || upper === "TEXT" || upper === "LONGTEXT" || upper === "JSON" || upper === "JSONB" || upper === "XML") {
    return { type: "CLOB", size: "" };
  }
  if (upper === "NCLOB") {
    return { type: "NCLOB", size: "" };
  }
  if (upper === "BLOB" || upper === "BYTEA" || upper === "BINARY" || upper === "VARBINARY" || upper === "IMAGE") {
    return { type: "BLOB", size: "" };
  }
  if (upper === "RAW" || upper === "UUID" || upper === "GUID") {
    return { type: "RAW", size: size || "16" };
  }
  if (upper === "BFILE") {
    return { type: "BFILE", size: "" };
  }

  // Fallback
  return { type: "VARCHAR2", size: size || "100" };
}

type ParsedMermaidEntity = {
  rawName: string;
  name: string;
  groupTitle?: string;
  columns: Array<{
    column: Column;
    isPk: boolean;
    isFk: boolean;
    isUk: boolean;
    isNotNull: boolean;
    comment: string;
  }>;
};

type ParsedMermaidRelationship = {
  entity1: string;
  card1: string;
  line: string;
  card2: string;
  entity2: string;
  label: string;
};

const RELATIONSHIP_REGEX = /^([A-Za-z0-9_$#-]+|"[^"]+"(?:\s*\[[^\]]+\])?)\s*(\|o|o\||\|\||\}\|\||\}o|o\{|\|\{|\}\{\|)\s*(--|\.\.)\s*(\|o|o\||\|\||\}\|\||\}o|o\{|\|\{|\}\{\|)\s*([A-Za-z0-9_$#-]+|"[^"]+"(?:\s*\[[^\]]+\])?)(?:\s*:\s*(.+))?$/i;

/** Parse Mermaid ER diagram into a Schema. */
export function parseMermaidER(mermaidText: string, options: ParseOptions = {}): ParseResult {
  const knownTables = options.knownTables ?? [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawLines = mermaidText.replace(/\r\n/g, "\n").split("\n");
  const entities: ParsedMermaidEntity[] = [];
  const relationships: ParsedMermaidRelationship[] = [];
  const explicitFkCols = new Set<string>();

  // Extract diagram title from top comments or title directive if present
  let diagramTitle = "Imported Mermaid Schema";
  const explicitTitleMatch =
    mermaidText.match(/^\s*title\s+(.+)$/im) ??
    mermaidText.match(/^\s*accTitle:\s*(.+)$/im);
  if (explicitTitleMatch) {
    diagramTitle = explicitTitleMatch[1].trim();
  } else {
    const firstComment = rawLines.find(
      (l) =>
        l.trim().startsWith("%%") &&
        !l.trim().startsWith("%%{") &&
        l.trim().length > 4,
    );
    if (firstComment) {
      const cleaned = firstComment
        .replace(/^%%\s*/, "")
        .replace(/\s*-\s*ER\s*(?:model|diagram)$/i, "")
        .trim();
      if (
        cleaned &&
        cleaned.length >= 3 &&
        !cleaned.includes("===") &&
        !cleaned.includes("---")
      ) {
        diagramTitle = cleaned;
      }
    }
  }

  let currentGroupTitle: string | undefined;
  let inEntity: ParsedMermaidEntity | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Check for comment lines
    if (trimmed.startsWith("%%")) {
      // Check if it's a section header comment (e.g. `%% ========== 1-QATLAM: O'ZGARMAS YADRO ==========`)
      const headerMatch =
        trimmed.match(/^%%\s*[=~#*_-]{2,}\s*([^=~#*_-].*?)\s*[=~#*_-]*$/) ??
        trimmed.match(/^%%\s*(?:Group|Layer|Section|Qatlam)\s*:\s*(.+)$/i);
      if (headerMatch && headerMatch[1]) {
        const titleCandidate = headerMatch[1].trim();
        const upper = titleCandidate.toUpperCase();
        const isPureRelSection =
          upper === "BOGLANISHLAR" ||
          upper === "RELATIONSHIPS" ||
          upper === "FOREIGN KEYS" ||
          (!/\d/.test(upper) &&
            !upper.includes("QATLAM") &&
            !upper.includes("LAYER") &&
            (upper.startsWith("BOGLANISH") || upper.startsWith("RELATIONSHIP")));

        if (!isPureRelSection && titleCandidate.length > 2) {
          currentGroupTitle = titleCandidate;
        }
      }
      continue;
    }

    // Skip diagram declaration and directives
    if (/^\s*erDiagram\b/i.test(trimmed)) continue;
    if (/^\s*title\b/i.test(trimmed)) continue;
    if (/^\s*accTitle:\b/i.test(trimmed)) continue;
    if (/^\s*accDescr\b/i.test(trimmed)) continue;

    // Inside an entity body
    if (inEntity) {
      if (trimmed === "}") {
        entities.push(inEntity);
        inEntity = null;
        continue;
      }

      // Column line inside entity
      // Strip trailing comments (e.g. `... %% comment`)
      const codePart = trimmed.replace(/\s*%%.*$/, "").trim();
      if (!codePart) continue;

      // Extract trailing quoted string for comment (e.g. `"PARTY - tashqi, FK yoq"`)
      let comment = "";
      let remaining = codePart;
      const commentMatch = remaining.match(/(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)')\s*$/);
      if (commentMatch) {
        comment = unescapeString(commentMatch[1] ?? commentMatch[2] ?? "");
        remaining = remaining.slice(0, commentMatch.index).trim();
      }

      // Check key tokens: PK, FK, UK, NN, NOT NULL, PRIMARY KEY, FOREIGN KEY, UNIQUE
      let isPk = false;
      let isFk = false;
      let isUk = false;
      let isNotNull = false;

      // Tokenize remaining parts
      const tokens = remaining.split(/\s+/).filter(Boolean);
      const remainingTokens: string[] = [];

      for (const token of tokens) {
        const upperToken = token.toUpperCase().replace(/,/g, "");
        if (upperToken === "PK") isPk = true;
        else if (upperToken === "FK") isFk = true;
        else if (upperToken === "UK") isUk = true;
        else if (upperToken === "NN" || upperToken === "NOT_NULL") isNotNull = true;
        else remainingTokens.push(token);
      }

      if (remainingTokens.length === 0) continue;

      let typeStr = "";
      let nameStr = "";

      if (remainingTokens.length === 1) {
        // Only one token: assume name, default type VARCHAR2
        nameStr = remainingTokens[0];
        typeStr = "VARCHAR2";
      } else if (
        remainingTokens.length >= 3 &&
        (remainingTokens[0].toUpperCase() === "TIMESTAMP" || remainingTokens[0].toUpperCase() === "INTERVAL" || remainingTokens[0].toUpperCase() === "DOUBLE" || remainingTokens[0].toUpperCase() === "BINARY")
      ) {
        // Multi-word type like `TIMESTAMP WITH TIME ZONE name` or `INTERVAL YEAR TO MONTH name`
        nameStr = remainingTokens[remainingTokens.length - 1];
        typeStr = remainingTokens.slice(0, remainingTokens.length - 1).join(" ");
      } else {
        // Standard: token 0 is type, token 1 is name
        typeStr = remainingTokens[0];
        nameStr = remainingTokens[1];
      }

      const colName = bareName(nameStr);
      const { type, size } = normalizeOracleType(typeStr);

      const col = makeColumn({
        name: colName,
        type,
        size,
        notNull: isPk || isNotNull,
        pk: isPk,
        unique: isUk,
        comment: comment || undefined,
      });

      if (isFk) {
        explicitFkCols.add(col.id);
      }

      inEntity.columns.push({
        column: col,
        isPk,
        isFk,
        isUk,
        isNotNull: isPk || isNotNull,
        comment,
      });

      continue;
    }

    // Check for entity start: `ENTITY_NAME {` or `ENTITY_NAME [`
    const entityStartMatch = trimmed.match(/^([A-Za-z0-9_$#-]+|"[^"]+"(?:\s*\[[^\]]+\])?)\s*\{/);
    if (entityStartMatch) {
      const rawEntityName = entityStartMatch[1];
      const name = bareName(rawEntityName);
      inEntity = {
        rawName: rawEntityName,
        name,
        groupTitle: currentGroupTitle,
        columns: [],
      };

      // Check if it's a single line entity like `DEPOSIT_CONTRACT { NUMBER id PK }`
      if (trimmed.endsWith("}") && trimmed.length > entityStartMatch[0].length) {
        const bodyContent = trimmed.slice(entityStartMatch[0].length, -1).trim();
        if (bodyContent) {
          // Parse columns inside single line
          const parts = bodyContent.split(";").map((p) => p.trim()).filter(Boolean);
          for (const part of parts) {
            const tokens = part.split(/\s+/).filter(Boolean);
            if (tokens.length >= 2) {
              const { type, size } = normalizeOracleType(tokens[0]);
              const cName = bareName(tokens[1]);
              const isPk = /PK/i.test(part);
              const isFk = /FK/i.test(part);
              const isUk = /UK/i.test(part);
              inEntity.columns.push({
                column: makeColumn({ name: cName, type, size, pk: isPk, notNull: isPk, unique: isUk }),
                isPk,
                isFk,
                isUk,
                isNotNull: isPk,
                comment: "",
              });
            }
          }
        }
        entities.push(inEntity);
        inEntity = null;
      }
      continue;
    }

    // Check for relationships
    const relMatch = trimmed.match(RELATIONSHIP_REGEX);
    if (relMatch) {
      const entity1 = bareName(relMatch[1]);
      const card1 = relMatch[2];
      const line = relMatch[3];
      const card2 = relMatch[4];
      const entity2 = bareName(relMatch[5]);
      let label = relMatch[6] ? relMatch[6].trim() : "";
      if (label.startsWith('"') && label.endsWith('"')) label = label.slice(1, -1).trim();
      if (label.startsWith("'") && label.endsWith("'")) label = label.slice(1, -1).trim();

      relationships.push({
        entity1,
        card1,
        line,
        card2,
        entity2,
        label,
      });
      continue;
    }

    // Standalone entity declaration: `ENTITY_NAME`
    if (/^[A-Za-z0-9_$#-]+$/.test(trimmed)) {
      entities.push({
        rawName: trimmed,
        name: bareName(trimmed),
        groupTitle: currentGroupTitle,
        columns: [],
      });
    }
  }

  if (inEntity) {
    entities.push(inEntity);
  }

  if (!entities.length) {
    errors.push("No entities found in Mermaid ER diagram.");
    return { schema: null, warnings, errors };
  }

  // Create table instances first so we can measure their actual dimensions
  const tables: Table[] = [];
  const tablesByName = new Map<string, Table>();

  entities.forEach((entity, idx) => {
    const table = makeTable(entity.name, 0, 0, idx % PALETTE.length);
    table.columns = entity.columns.length
      ? entity.columns.map((c) => c.column)
      : [makeColumn({ name: "ID", type: "NUMBER", size: "", notNull: true, pk: true })];

    const pkCols = primaryKeyColumns(table);
    table.keyStrategy = pkCols.length === 1 && pkCols[0].type === "NUMBER" ? "sequence-trigger" : "none";

    tables.push(table);
    tablesByName.set(normalizeIdentifier(table.name), table);
  });

  // Organize groups and compute dynamic layout
  const groups: SchemaGroup[] = [];
  const groupTitles = [...new Set(entities.map((e) => e.groupTitle).filter(Boolean))];

  if (groupTitles.length > 0) {
    // 1. Assign tables to groups
    const groupTablesMap = new Map<string, Table[]>();
    groupTitles.forEach((title, idx) => {
      const group = makeSchemaGroup(title!, 80, 80, idx % GROUP_COLORS.length);
      group.color = GROUP_COLORS[idx % GROUP_COLORS.length];
      groups.push(group);

      const memberEntities = entities.filter((e) => e.groupTitle === title);
      const memberTables = memberEntities
        .map((e) => tablesByName.get(normalizeIdentifier(e.name)))
        .filter(Boolean) as Table[];

      memberTables.forEach((t) => {
        t.schemaId = group.id;
      });
      groupTablesMap.set(group.id, memberTables);
    });

    // 2. Compute group widths to arrange columns
    const calcGroupWidth = (memberTables: Table[]) => {
      const num = memberTables.length;
      const tCols = num >= 6 ? 3 : num >= 2 ? 2 : 1;
      let totalWidth = 60; // 30px left + 30px right padding
      for (let c = 0; c < tCols; c++) {
        const colTables = memberTables.filter((_, idx) => idx % tCols === c);
        const colW = Math.max(
          ...colTables.map((t) => Math.max(tableWidth(t), 280)),
          280,
        );
        totalWidth += colW + (c > 0 ? 40 : 0);
      }
      return Math.max(380, totalWidth);
    };

    // Calculate column 0 max width for 2-column group placement
    const col0Groups = groups.filter((_, idx) => idx % 2 === 0);
    const col0Width = Math.max(
      ...col0Groups.map((g) => calcGroupWidth(groupTablesMap.get(g.id) ?? [])),
      780,
    );

    const nextGroupY = [80, 80];

    groups.forEach((group, gIdx) => {
      const gCol = gIdx % 2;
      const memberTables = groupTablesMap.get(group.id) ?? [];
      const numTables = memberTables.length;
      const tCols = numTables >= 6 ? 3 : numTables >= 2 ? 2 : 1;
      const tRows = Math.max(1, Math.ceil(numTables / tCols));

      group.x = gCol === 0 ? 80 : 80 + col0Width + 60;
      group.y = nextGroupY[gCol];

      // Measure column widths
      const colWidths: number[] = [];
      for (let c = 0; c < tCols; c++) {
        const colTables = memberTables.filter((_, idx) => idx % tCols === c);
        const colW = Math.max(
          ...colTables.map((t) => Math.max(tableWidth(t), 280)),
          280,
        );
        colWidths.push(colW);
      }

      // Measure row heights
      const rowHeights: number[] = [];
      for (let r = 0; r < tRows; r++) {
        const rowTables = memberTables.filter(
          (_, idx) => Math.floor(idx / tCols) === r,
        );
        const rowH = Math.max(
          ...rowTables.map((t) => tableHeight(t)),
          180,
        );
        rowHeights.push(rowH);
      }

      // Calculate table X and Y positions
      const colX: number[] = [];
      let curX = group.x + 30;
      for (let c = 0; c < tCols; c++) {
        colX.push(curX);
        curX += colWidths[c] + 40;
      }

      const rowY: number[] = [];
      let curY = group.y + 60;
      for (let r = 0; r < tRows; r++) {
        rowY.push(curY);
        curY += rowHeights[r] + 40;
      }

      memberTables.forEach((table, eIdx) => {
        const c = eIdx % tCols;
        const r = Math.floor(eIdx / tCols);
        table.x = colX[c];
        table.y = rowY[r];
      });

      group.width = Math.max(
        380,
        colX[tCols - 1] + colWidths[tCols - 1] + 30 - group.x,
      );
      group.height = Math.max(
        260,
        rowY[tRows - 1] + rowHeights[tRows - 1] + 30 - group.y,
      );

      nextGroupY[gCol] = group.y + group.height + 60;
    });

    // Handle any orphan tables without a group
    const orphanTables = tables.filter((t) => !t.schemaId);
    if (orphanTables.length > 0) {
      let curOrphanY = Math.max(...nextGroupY) + 20;
      const orphanCols = Math.min(
        4,
        Math.max(2, Math.ceil(Math.sqrt(orphanTables.length))),
      );
      const orphanRows = Math.ceil(orphanTables.length / orphanCols);

      for (let r = 0; r < orphanRows; r++) {
        const rowTables = orphanTables.filter(
          (_, idx) => Math.floor(idx / orphanCols) === r,
        );
        const rowH = Math.max(
          ...rowTables.map((t) => tableHeight(t)),
          180,
        );
        rowTables.forEach((table, c) => {
          table.x = 80 + c * 340;
          table.y = curOrphanY;
        });
        curOrphanY += rowH + 40;
      }
    }
  } else {
    // No groups detected: responsive grid with dynamic table height and width
    const gridCols = Math.min(
      4,
      Math.max(2, Math.ceil(Math.sqrt(tables.length))),
    );
    const gridRows = Math.ceil(tables.length / gridCols);

    const colWidths: number[] = [];
    for (let c = 0; c < gridCols; c++) {
      const colTables = tables.filter((_, idx) => idx % gridCols === c);
      const colW = Math.max(
        ...colTables.map((t) => Math.max(tableWidth(t), 280)),
        280,
      );
      colWidths.push(colW);
    }

    const rowHeights: number[] = [];
    for (let r = 0; r < gridRows; r++) {
      const rowTables = tables.filter(
        (_, idx) => Math.floor(idx / gridCols) === r,
      );
      const rowH = Math.max(
        ...rowTables.map((t) => tableHeight(t)),
        180,
      );
      rowHeights.push(rowH);
    }

    const colX: number[] = [];
    let curX = 80;
    for (let c = 0; c < gridCols; c++) {
      colX.push(curX);
      curX += colWidths[c] + 40;
    }

    const rowY: number[] = [];
    let curY = 80;
    for (let r = 0; r < gridRows; r++) {
      rowY.push(curY);
      curY += rowHeights[r] + 40;
    }

    tables.forEach((table, idx) => {
      const c = idx % gridCols;
      const r = Math.floor(idx / gridCols);
      table.x = colX[c];
      table.y = rowY[r];
    });
  }

  // Resolve Relationships and Foreign Keys
  const importedRelationships: Relationship[] = [];
  const linkedChildCols = new Set<string>(); // columnId of child table

  function findTableByName(name: string): Table | undefined {
    const norm = normalizeIdentifier(name);
    return tablesByName.get(norm) ?? knownTables.find((t) => normalizeIdentifier(t.name) === norm);
  }

  function getParentPk(parentTable: Table): Column {
    const pks = primaryKeyColumns(parentTable);
    return pks[0] ?? parentTable.columns[0];
  }

  relationships.forEach((rel) => {
    const t1 = findTableByName(rel.entity1);
    const t2 = findTableByName(rel.entity2);

    if (!t1 || !t2) {
      warnings.push(`Skipped relationship ${rel.entity1} <-> ${rel.entity2}: table not found.`);
      return;
    }

    const isLeftMany = /[\}\{]/.test(rel.card1);
    const isLeftOne = !isLeftMany;
    const isRightMany = /[\}\{]/.test(rel.card2);
    const isRightOne = !isRightMany;

    let parentTable: Table;
    let childTable: Table;
    let isOneToOne = false;

    if (isLeftOne && isRightMany) {
      parentTable = t1;
      childTable = t2;
    } else if (isLeftMany && isRightOne) {
      parentTable = t2;
      childTable = t1;
    } else if (isLeftOne && isRightOne) {
      isOneToOne = true;
      // Inspect columns to determine parent and child
      const parentPk1 = getParentPk(t1);
      const parentPk2 = getParentPk(t2);

      const t2HasRefToT1 = t2.columns.some(
        (c) =>
          normalizeIdentifier(c.name) === normalizeIdentifier(parentPk1.name) ||
          c.name.toUpperCase().endsWith(`_${parentPk1.name.toUpperCase()}`),
      );
      const t1HasRefToT2 = t1.columns.some(
        (c) =>
          normalizeIdentifier(c.name) === normalizeIdentifier(parentPk2.name) ||
          c.name.toUpperCase().endsWith(`_${parentPk2.name.toUpperCase()}`),
      );

      if (t2HasRefToT1 && !t1HasRefToT2) {
        parentTable = t1;
        childTable = t2;
      } else if (t1HasRefToT2 && !t2HasRefToT1) {
        parentTable = t2;
        childTable = t1;
      } else {
        parentTable = t1;
        childTable = t2;
      }
    } else {
      // Many to many fallback
      parentTable = t1;
      childTable = t2;
    }

    const parentPk = getParentPk(parentTable);
    const parentPkNorm = normalizeIdentifier(parentPk.name);
    const parentTableNorm = normalizeIdentifier(parentTable.name);

    // Search best child column to link
    type Candidate = { col: Column; score: number };
    const candidates: Candidate[] = [];

    childTable.columns.forEach((col) => {
      const colNorm = normalizeIdentifier(col.name);
      const isAlreadyLinked = linkedChildCols.has(col.id);
      let score = 0;

      // Exact name match with parent PK
      if (colNorm === parentPkNorm) {
        score = col.fk ? 100 : 90;
      } else if (colNorm.endsWith(`_${parentPkNorm}`)) {
        score = col.fk ? 80 : 70;
      } else if (
        colNorm === `${parentTableNorm}_ID` ||
        colNorm.startsWith(`${parentTableNorm}_`) ||
        colNorm === `${parentTableNorm.replace(/S$/, "")}_ID`
      ) {
        score = col.fk ? 65 : 60;
      } else if (col.type === parentPk.type && (col.name.includes("ID") || col.name.includes("REF"))) {
        score = col.fk ? 50 : 30;
      } else if (col.type === parentPk.type) {
        score = 20;
      } else {
        score = 5;
      }

      if (isAlreadyLinked) score -= 50;
      candidates.push({ col, score });
    });

    candidates.sort((a, b) => b.score - a.score);
    const bestChildCol = candidates[0]?.col ?? childTable.columns[0];

    if (bestChildCol && parentPk) {
      bestChildCol.fk = { tableId: parentTable.id, columnId: parentPk.id };
      linkedChildCols.add(bestChildCol.id);

      const relId = nextId("rel");
      importedRelationships.push({
        id: relId,
        startTableId: childTable.id,
        startFieldId: bestChildCol.id,
        endTableId: parentTable.id,
        endFieldId: parentPk.id,
        fields: [{ startFieldId: bestChildCol.id, endFieldId: parentPk.id }],
        name: rel.label || `fk_${childTable.name}_${bestChildCol.name}_${parentTable.name}`,
        cardinality: isOneToOne ? "one_to_one" : "many_to_one",
        manyLabel: "n",
        updateConstraint: "No action",
        deleteConstraint: "No action",
      });
    }
  });

  // Resolve self-referencing FK columns (e.g. `parent_contract_id FK`, `reversal_of FK`)
  tables.forEach((table) => {
    const tablePk = primaryKeyColumns(table)[0] ?? table.columns[0];
    if (!tablePk) return;
    const tableNorm = normalizeIdentifier(table.name);

    table.columns.forEach((col) => {
      if (linkedChildCols.has(col.id)) return;
      if (!explicitFkCols.has(col.id)) return; // MUST be explicitly marked FK

      const colNorm = normalizeIdentifier(col.name);
      const isSelfRef =
        colNorm.startsWith("PARENT_") ||
        colNorm.startsWith("REVERSAL_") ||
        colNorm.startsWith("PREV_") ||
        colNorm.startsWith("ROOT_") ||
        colNorm.startsWith("NEXT_") ||
        colNorm === "PARENT_ID" ||
        colNorm === "REVERSAL_OF" ||
        colNorm.includes(tableNorm);

      if (isSelfRef && col.type === tablePk.type && col.id !== tablePk.id) {
        col.fk = { tableId: table.id, columnId: tablePk.id };
        linkedChildCols.add(col.id);

        const relId = nextId("rel");
        importedRelationships.push({
          id: relId,
          startTableId: table.id,
          startFieldId: col.id,
          endTableId: table.id,
          endFieldId: tablePk.id,
          fields: [{ startFieldId: col.id, endFieldId: tablePk.id }],
          name: `fk_${table.name}_${col.name}_self`,
          cardinality: "many_to_one",
          manyLabel: "n",
          updateConstraint: "No action",
          deleteConstraint: "No action",
        });
      }
    });
  });

  // Resolve unlinked explicit FK columns pointing to other tables in the schema
  tables.forEach((table) => {
    table.columns.forEach((col) => {
      if (linkedChildCols.has(col.id)) return;
      if (!explicitFkCols.has(col.id)) return; // MUST be explicitly marked FK

      const colNorm = normalizeIdentifier(col.name);

      type TableCandidate = { target: Table; pk: Column; score: number };
      const candidates: TableCandidate[] = [];

      for (const candidateTable of tables) {
        if (candidateTable.id === table.id) continue;
        const candidatePk = getParentPk(candidateTable);
        const candidatePkNorm = normalizeIdentifier(candidatePk.name);
        const candidateTableNorm = normalizeIdentifier(candidateTable.name);

        if (col.type !== candidatePk.type) continue;

        let score = 0;

        // Exact match of table name with column prefix (e.g. table OPERATION with column operation_id)
        if (colNorm === `${candidateTableNorm}_ID`) {
          score += 100;
        }

        // Exact match of PK name
        if (colNorm === candidatePkNorm) {
          score += 90;
        }

        // Column ends with _PK (e.g. target_contract_id ends with _contract_id)
        if (colNorm.endsWith(`_${candidatePkNorm}`)) {
          score += 75;
        }

        // Table name singular matches column prefix
        if (
          colNorm === `${candidateTableNorm.replace(/S$/, "")}_ID` ||
          colNorm === `${candidateTableNorm.replace(/ES$/, "")}_ID`
        ) {
          score += 70;
        }

        // Column contains table name
        if (colNorm.includes(candidateTableNorm)) {
          score += 40;
        }

        if (score > 0) {
          candidates.push({ target: candidateTable, pk: candidatePk, score });
        }
      }

      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0];

      if (best) {
        col.fk = { tableId: best.target.id, columnId: best.pk.id };
        linkedChildCols.add(col.id);

        const relId = nextId("rel");
        importedRelationships.push({
          id: relId,
          startTableId: table.id,
          startFieldId: col.id,
          endTableId: best.target.id,
          endFieldId: best.pk.id,
          fields: [{ startFieldId: col.id, endFieldId: best.pk.id }],
          name: `fk_${table.name}_${col.name}_${best.target.name}`,
          cardinality: "many_to_one",
          manyLabel: "n",
          updateConstraint: "No action",
          deleteConstraint: "No action",
        });
      }
    });
  });


  const importedSchema: Schema = {
    id: nextId("schema"),
    name: diagramTitle,
    revision: 1,
    schemaFormatVersion: SCHEMA_FORMAT_VERSION,
    tables,
    groups: groups.length ? groups : undefined,
    relationships: importedRelationships,
  };

  return {
    schema: options.knownTables ? importedSchema : normalizeRelationships(importedSchema),
    warnings,
    errors,
  };
}

/** Append Mermaid ER diagram tables to an existing schema without overwriting existing tables. */
export function appendMermaidER(base: Schema, mermaidText: string): AppendResult {
  const parsed = parseMermaidER(mermaidText, { knownTables: base.tables });
  if (!parsed.schema) {
    return {
      schema: null,
      added: [],
      skipped: [],
      warnings: parsed.warnings,
      errors: parsed.errors,
    };
  }

  const deferred = new Map<string, Table>();
  const deferredColumns = new Map<string, string>();
  const skipped: string[] = [];
  const fresh: Table[] = [];

  parsed.schema.tables.forEach((table) => {
    const match = base.tables.find(
      (t) => normalizeIdentifier(t.name) === normalizeIdentifier(table.name),
    );
    if (!match) {
      fresh.push(table);
      return;
    }
    skipped.push(match.name);
    deferred.set(table.id, match);
    table.columns.forEach((col) => {
      const twin = match.columns.find(
        (c) => normalizeIdentifier(c.name) === normalizeIdentifier(col.name),
      );
      if (twin) deferredColumns.set(col.id, twin.id);
    });
  });

  if (!fresh.length) {
    return {
      schema: null,
      added: [],
      skipped,
      warnings: parsed.warnings,
      errors: [`Already in this project: ${skipped.join(", ")}. Nothing new to add.`],
    };
  }

  const rewire = (ref: ForeignKeyRef | null): ForeignKeyRef | null => {
    if (!ref) return null;
    const target = deferred.get(ref.tableId);
    if (!target) return ref;
    const columnId = deferredColumns.get(ref.columnId);
    return columnId ? { tableId: target.id, columnId } : null;
  };

  const edges = contentEdges(base);
  const originX = Math.min(...fresh.map((t) => t.x));
  const originY = Math.min(...fresh.map((t) => t.y));
  const dx = edges ? edges.left - originX : 0;
  const dy = edges ? edges.bottom + APPEND_GAP - originY : 0;

  const added = fresh.map((table, index) => ({
    ...table,
    x: table.x + dx,
    y: table.y + dy,
    color: PALETTE[(base.tables.length + index) % PALETTE.length],
    columns: table.columns.map((col) => ({ ...col, fk: rewire(col.fk) })),
  }));

  const addedIds = new Set(added.map((t) => t.id));
  const relationships = (parsed.schema.relationships ?? [])
    .filter((rel) => addedIds.has(rel.startTableId))
    .map((rel) => ({
      ...rel,
      id: nextId("rel"),
      endTableId: deferred.get(rel.endTableId)?.id ?? rel.endTableId,
      endFieldId: deferredColumns.get(rel.endFieldId) ?? rel.endFieldId,
      fields: rel.fields.map((pair) => ({
        startFieldId: pair.startFieldId,
        endFieldId: deferredColumns.get(pair.endFieldId) ?? pair.endFieldId,
      })),
    }));

  // Merge groups if present
  const addedGroups = (parsed.schema.groups ?? []).map((group) => ({
    ...group,
    id: nextId("group"),
    x: group.x + dx,
    y: group.y + dy,
  }));

  // Map table schemaIds to the newly minted group ids
  if (parsed.schema.groups && addedGroups.length) {
    const oldGroupToNew = new Map<string, string>();
    parsed.schema.groups.forEach((oldG, idx) => {
      oldGroupToNew.set(oldG.id, addedGroups[idx].id);
    });
    added.forEach((t) => {
      if (t.schemaId && oldGroupToNew.has(t.schemaId)) {
        t.schemaId = oldGroupToNew.get(t.schemaId);
      }
    });
  }

  const ground = base.relationships?.length ? base : normalizeRelationships(base);
  const schema = normalizeRelationships({
    ...ground,
    tables: [...ground.tables, ...added],
    groups: [...(ground.groups ?? []), ...addedGroups],
    relationships: [...(ground.relationships ?? []), ...relationships],
  });

  return { schema, added, skipped, warnings: parsed.warnings, errors: [] };
}

/** Generate Mermaid ER diagram syntax from a Schema. */
export function generateMermaidER(schema: Schema): string {
  const canonical = normalizeRelationships(schema);
  const lines: string[] = ["erDiagram", ""];

  canonical.tables.forEach((table) => {
    lines.push(`    ${normalizeIdentifier(table.name)} {`);
    table.columns.forEach((column) => {
      const typeStr = column.size ? `${column.type}(${column.size})` : column.type;
      const keys: string[] = [];
      if (column.pk) keys.push("PK");
      if (column.fk) keys.push("FK");
      if (column.unique && !column.pk) keys.push("UK");

      const keyPart = keys.length ? ` ${keys.join(", ")}` : "";
      const commentPart = column.comment ? ` "${column.comment.replace(/"/g, '\\"')}"` : "";

      lines.push(`        ${typeStr} ${column.name}${keyPart}${commentPart}`);
    });
    lines.push("    }", "");
  });

  if (canonical.relationships && canonical.relationships.length > 0) {
    lines.push("    %% Relationships");
    canonical.relationships.forEach((rel) => {
      const startTable = canonical.tables.find((t) => t.id === rel.startTableId);
      const endTable = canonical.tables.find((t) => t.id === rel.endTableId);
      if (!startTable || !endTable) return;

      const parentName = normalizeIdentifier(endTable.name);
      const childName = normalizeIdentifier(startTable.name);
      const label = rel.name ? ` : "${rel.name.replace(/"/g, '\\"')}"` : "";

      const arrow = rel.cardinality === "one_to_one" ? "||--||" : "||--o{";
      lines.push(`    ${parentName} ${arrow} ${childName}${label}`);
    });
  }

  return lines.join("\n");
}
