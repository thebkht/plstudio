import { describe, expect, it, vi } from "vitest";
import { documentNameFor, projectIdFrom, signCollabToken, verifyCollabToken } from "@/app/lib/collab/token";

const SECRET = "test-secret";
const claims = { sub: "user_1", name: "Ada", image: null, documentName: "project:abc", readOnly: false };

describe("collab tokens", () => {
  it("round-trips the claims it was signed with", () => {
    expect(verifyCollabToken(signCollabToken(claims, SECRET), SECRET)).toMatchObject(claims);
  });

  it("rejects a token signed with a different secret", () => {
    expect(verifyCollabToken(signCollabToken(claims, "other-secret"), SECRET)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, signature] = signCollabToken(claims, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, readOnly: false, exp: 9999999999 })).toString("base64url");
    expect(verifyCollabToken(`${forged}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects an attempt to widen a read-only grant", () => {
    const token = signCollabToken({ ...claims, readOnly: true }, SECRET);
    const [payload, signature] = token.split(".");
    const widened = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), readOnly: false })).toString("base64url");
    expect(verifyCollabToken(`${widened}.${signature}`, SECRET)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "nodot", ".", "a.b.c", "..".repeat(3)]) expect(verifyCollabToken(bad, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signCollabToken(claims, SECRET, 60);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(verifyCollabToken(token, SECRET)).toBeNull();
    vi.useRealTimers();
  });

  it("carries the read-only verdict", () => {
    expect(verifyCollabToken(signCollabToken({ ...claims, readOnly: true }, SECRET), SECRET)?.readOnly).toBe(true);
  });
});

describe("document names", () => {
  it("round-trips a project id", () => {
    expect(projectIdFrom(documentNameFor("abc-123"))).toBe("abc-123");
  });
});
