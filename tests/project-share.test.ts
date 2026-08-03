import { describe, expect, it } from "vitest";
import { hashProjectShareToken } from "@/app/lib/project-share";
import { canManageProjectShare } from "@/app/lib/workspace";

describe("project share links", () => {
  it("hashes tokens deterministically without returning the raw token", () => {
    expect(hashProjectShareToken("invite-token")).toBe(hashProjectShareToken("invite-token"));
    expect(hashProjectShareToken("invite-token")).not.toBe("invite-token");
    expect(hashProjectShareToken("invite-token")).not.toBe(hashProjectShareToken("other-token"));
  });

  it("allows project creators and workspace owners/admins to manage links", () => {
    expect(canManageProjectShare("creator", "creator", "member")).toBe(true);
    expect(canManageProjectShare("other", "creator", "owner")).toBe(true);
    expect(canManageProjectShare("other", "creator", "admin")).toBe(true);
    expect(canManageProjectShare("other", "creator", "member")).toBe(false);
  });
});
