import { describe, expect, it } from "vitest";
import { assignableRoles, canChangeMemberRole, canDeleteProject, canManageMembers, slugify } from "@/app/lib/workspace";

describe("workspace helpers", () => {
  it("slugifies workspace names", () => expect(slugify("  My Oracle Workspace! ")).toBe("my-oracle-workspace"));
  it("caps slugs", () => expect(slugify("a".repeat(100))).toHaveLength(48));
  it("limits member management to owners and admins", () => { expect(canManageMembers("owner")).toBe(true); expect(canManageMembers("admin")).toBe(true); expect(canManageMembers("member")).toBe(false); });
  it("limits project deletion to owners and admins", () => { expect(canDeleteProject("owner")).toBe(true); expect(canDeleteProject("admin")).toBe(true); expect(canDeleteProject("member")).toBe(false); });
  it("only lets owners hand out ownership", () => { expect(assignableRoles("owner")).toEqual(["owner", "admin", "member"]); expect(assignableRoles("admin")).toEqual(["admin", "member"]); expect(assignableRoles("member")).toEqual([]); });
  it("blocks self-demotion", () => { expect(canChangeMemberRole("owner", "owner", true)).toBe(false); expect(canChangeMemberRole("admin", "member", true)).toBe(false); });
  it("stops admins from editing owners", () => { expect(canChangeMemberRole("admin", "owner", false)).toBe(false); expect(canChangeMemberRole("admin", "admin", false)).toBe(true); expect(canChangeMemberRole("owner", "owner", false)).toBe(true); });
  it("keeps plain members out entirely", () => expect(canChangeMemberRole("member", "member", false)).toBe(false));
});
