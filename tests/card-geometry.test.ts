import { describe, expect, it } from "vitest";
import {
  COMMENT_LINE_HEIGHT,
  COMMENT_MAX_LINES,
  COMMENT_PADDING,
  DOCUMENT_HEADER_HEIGHT,
  TABLE_COLOR_STRIP_HEIGHT,
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  commentLines,
  makeTable,
  tableHeaderHeight,
  tableHeight,
  wrapText,
} from "@/app/lib/schema";

describe("card geometry", () => {
  it("keeps the classic card exactly as tall as it always was", () => {
    const table = makeTable("STUDENT", 0, 0);
    table.comment = "A long comment the classic card never shows, however long it runs.";
    expect(tableHeight(table)).toBe(TABLE_COLOR_STRIP_HEIGHT + TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT);
    expect(tableHeight(table, "classic")).toBe(tableHeight(table));
  });

  it("grows a document card by its wrapped comment, and not at all without one", () => {
    const table = makeTable("STUDENT", 0, 0);
    expect(tableHeaderHeight(table, "document")).toBe(DOCUMENT_HEADER_HEIGHT);
    table.comment = "Students enrolled in at least one course this year.";
    const lines = commentLines(table).length;
    expect(lines).toBe(2);
    expect(tableHeaderHeight(table, "document")).toBe(DOCUMENT_HEADER_HEIGHT + lines * COMMENT_LINE_HEIGHT + 2 * COMMENT_PADDING);
  });

  it("caps the comment and marks the cut", () => {
    const table = makeTable("STUDENT", 0, 0);
    table.comment = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
    const lines = commentLines(table);
    expect(lines).toHaveLength(COMMENT_MAX_LINES);
    expect(lines[COMMENT_MAX_LINES - 1].endsWith("…")).toBe(true);
  });

  it("wraps on words, splits a word longer than a line, and keeps blank lines", () => {
    expect(wrapText("insert into ies_day_count_types values", 12)).toEqual(["insert into", "ies_day_coun", "t_types", "values"]);
    expect(wrapText("a\n\nb", 10)).toEqual(["a", "", "b"]);
  });
});
