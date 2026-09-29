import { describe, expect, it } from "vitest";
import { renderDiagramSVG } from "@/app/components/designer/diagram-svg";
import { makeColumn, makeDemoSchema, makeMemo, makeSchemaGroup, makeTable, normalizeRelationships, tableHeight, tableWidth } from "@/app/lib/schema";

const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)![1].split(" ").map(Number);

describe("renderDiagramSVG", () => {
  it("draws every table and column of the diagram", () => {
    const schema = makeDemoSchema();
    const svg = renderDiagramSVG(schema);
    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
    schema.tables.forEach((table) => {
      expect(svg).toContain(`>${table.name}</text>`);
      table.columns.forEach((column) => expect(svg).toContain(column.name));
    });
    // The demo's one foreign key, routed and drawn with its cardinality markers.
    expect(svg.match(/<path d="M /g)).toHaveLength(1);
  });

  it("escapes text so a hostile name cannot break out of the document", () => {
    const schema = makeDemoSchema();
    schema.name = `A & B <script>`;
    schema.tables[0].name = `T<"x">&'`;
    schema.memos = [{ ...makeMemo(`</text><script>alert(1)</script>`, 0, 0), id: "memo_1" }];
    const svg = renderDiagramSVG(schema);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("A &amp; B &lt;script&gt;");
    expect(svg).toContain("T&lt;&quot;X&quot;&gt;&amp;&apos;");
  });

  it("frames every card, group and memo inside the viewBox", () => {
    const schema = makeDemoSchema();
    schema.tables.push({ ...makeTable("FAR_AWAY", -900, 1400), id: "tbl_far" });
    schema.groups = [{ ...makeSchemaGroup("Core", 2000, -300), id: "group_1" }];
    schema.memos = [{ ...makeMemo("note", -1200, -500), id: "memo_1" }];
    const [x, y, width, height] = viewBox(renderDiagramSVG(schema));
    const boxes = [
      ...schema.tables.map((table) => ({ x: table.x, y: table.y, width: tableWidth(table), height: tableHeight(table) })),
      ...schema.groups,
      ...schema.memos,
    ];
    boxes.forEach((box) => {
      expect(box.x).toBeGreaterThanOrEqual(x);
      expect(box.y).toBeGreaterThanOrEqual(y);
      expect(box.x + box.width).toBeLessThanOrEqual(x + width);
      expect(box.y + box.height).toBeLessThanOrEqual(y + height);
    });
  });

  it("is deterministic, and themed", () => {
    const schema = normalizeRelationships(makeDemoSchema());
    schema.tables[1].columns.push(makeColumn({ name: "NOTE" }));
    expect(renderDiagramSVG(schema)).toBe(renderDiagramSVG(structuredClone(schema)));
    expect(renderDiagramSVG(schema, { theme: "dark" })).not.toBe(renderDiagramSVG(schema));
  });

  it("renders an empty diagram as a small blank canvas", () => {
    const schema = makeDemoSchema();
    schema.tables = [];
    schema.relationships = [];
    expect(viewBox(renderDiagramSVG(schema))).toEqual([0, 0, 96, 96]);
  });

  it("paints memos in literal colours, since an exported file has no stylesheet for var() to resolve against", () => {
    const schema = makeDemoSchema();
    schema.memos = (["yellow", "green", "blue", "pink"] as const).map((color, index) => ({ ...makeMemo("note", index * 300, 600, color), id: `memo_${index}` }));
    (["light", "dark"] as const).forEach((theme) => expect(renderDiagramSVG(schema, { theme })).not.toContain("var("));
    expect(renderDiagramSVG(schema)).toContain(`fill="#f4efdc"`);
  });

  it("wraps memo text across lines and marks what does not fit", () => {
    const schema = makeDemoSchema();
    const sql = "insert into ies_day_count_types (day_count_type, name_mll_code) values (ies_day_count_types_seq.nextval, 'ACT/365');";
    schema.memos = [{ ...makeMemo(sql, 0, 600), id: "memo_1", width: 240, height: 120 }];
    const lines = [...renderDiagramSVG(schema).matchAll(/<tspan x="14" dy="\d+">([^<]*)<\/tspan>/g)].map((match) => match[1]);
    expect(lines).toHaveLength(4);
    // 28 characters to a 240px memo, so the table name moves to its own line whole.
    expect(lines.slice(0, 2)).toEqual(["insert into", "ies_day_count_types"]);
    expect(lines[3].endsWith("…")).toBe(true);
  });
});
