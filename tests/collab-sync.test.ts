import { describe, expect, it, vi } from "vitest";
import { createSyncStore, revisionFromStateless } from "@/app/lib/collab/sync";

describe("createSyncStore", () => {
  it("starts unsynced and only notifies when the answer changes", () => {
    const store = createSyncStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get()).toBe(false);
    store.set(false);
    expect(listener).not.toHaveBeenCalled();
    store.set(true);
    store.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toBe(true);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createSyncStore();
    const listener = vi.fn();
    store.subscribe(listener)();
    store.set(true);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("revisionFromStateless", () => {
  it("reads the revision the server broadcasts after a store", () => {
    expect(revisionFromStateless(JSON.stringify({ revision: 12 }))).toBe(12);
  });

  it("ignores anything that is not one", () => {
    expect(revisionFromStateless("not json")).toBeNull();
    expect(revisionFromStateless("null")).toBeNull();
    expect(revisionFromStateless(JSON.stringify({ revision: "12" }))).toBeNull();
    expect(revisionFromStateless(JSON.stringify({ other: 1 }))).toBeNull();
  });
});
