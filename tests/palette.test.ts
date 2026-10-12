import { describe, expect, it } from "vitest";
import { matchScore, paletteItems, rankPaletteItems } from "@/app/lib/palette";
import { makeColumnTemplate, makeDemoSchema, makeTable } from "@/app/lib/schema";
import { shortcutById } from "@/app/lib/shortcuts";

describe("command palette", () => {
  it("offers every runnable shortcut, each one a real shortcut id", () => {
    const commands = paletteItems(makeDemoSchema(), { readOnly: false }).filter((item) => item.kind === "command");
    expect(commands.length).toBeGreaterThan(10);
    commands.forEach((item) => item.kind === "command" && expect(shortcutById(item.shortcut)).toBeDefined());
    expect(commands.map((item) => item.kind === "command" && item.shortcut)).not.toContain("pasteSelection");
    expect(commands.map((item) => item.kind === "command" && item.shortcut)).not.toContain("commandPalette");
  });

  it("drops editing commands and templates on a read-only link", () => {
    const schema = makeDemoSchema();
    const items = paletteItems(schema, { readOnly: true, selectedTableId: schema.tables[0].id });
    expect(items.some((item) => item.kind === "command" && shortcutById(item.shortcut)?.mutating)).toBe(false);
    expect(items.some((item) => item.kind === "template")).toBe(false);
    expect(items.some((item) => item.kind === "table")).toBe(true);
  });

  it("offers built-in and project templates for the selected table only", () => {
    const schema = { ...makeDemoSchema(), columnTemplates: [makeColumnTemplate("Tenant", [])] };
    expect(paletteItems(schema, { readOnly: false }).some((item) => item.kind === "template")).toBe(false);
    const templates = paletteItems(schema, { readOnly: false, selectedTableId: schema.tables[0].id }).filter((item) => item.kind === "template");
    expect(templates.map((item) => item.label)).toContain("Insert Tenant");
    expect(templates.map((item) => item.label)).toContain("Insert Audit columns");
  });

  it("lists commands and tables, not columns, before anything is typed", () => {
    const ranked = rankPaletteItems(paletteItems(makeDemoSchema(), { readOnly: false }), "");
    expect(ranked.some((item) => item.kind === "column")).toBe(false);
    expect(ranked.some((item) => item.kind === "table")).toBe(true);
  });

  it("ranks a prefix above a word start above a scattered match, shorter first", () => {
    const schema = { ...makeDemoSchema(), tables: [makeTable("ORDERS_ARCHIVE", 0, 0), makeTable("ORDERS", 0, 0), makeTable("CUSTOMER_ORDERS", 0, 0), makeTable("OLD_RIDERS", 0, 0)] };
    const tables = rankPaletteItems(paletteItems(schema, { readOnly: false }), "orders").filter((item) => item.kind === "table");
    expect(tables.map((item) => item.label)).toEqual(["ORDERS", "ORDERS_ARCHIVE", "CUSTOMER_ORDERS", "OLD_RIDERS"]);
  });

  it("finds a column by its qualified name", () => {
    const ranked = rankPaletteItems(paletteItems(makeDemoSchema(), { readOnly: false }), "enrollment.status");
    expect(ranked[0]).toMatchObject({ kind: "column", label: "ENROLLMENT.STATUS" });
  });

  it("rejects a query whose letters are not all present in order", () => {
    expect(matchScore("STUDENT", "tsx")).toBeNull();
    expect(matchScore("STUDENT", "sdt")).not.toBeNull();
  });
});
