import { describe, expect, it } from "vitest";
import { canDeleteProject, canManageMembers, slugify } from "@/app/lib/workspace";

describe("workspace helpers", () => {
  it("slugifies workspace names", () => expect(slugify("  My Oracle Workspace! ")).toBe("my-oracle-workspace"));
  it("caps slugs", () => expect(slugify("a".repeat(100))).toHaveLength(48));
  it("limits member management to owners and admins", () => { expect(canManageMembers("owner")).toBe(true); expect(canManageMembers("admin")).toBe(true); expect(canManageMembers("member")).toBe(false); });
  it("limits project deletion to owners and admins", () => { expect(canDeleteProject("owner")).toBe(true); expect(canDeleteProject("admin")).toBe(true); expect(canDeleteProject("member")).toBe(false); });
});
