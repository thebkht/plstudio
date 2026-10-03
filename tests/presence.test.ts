import { describe, expect, it, vi } from "vitest";
import { createCursorStore, samePeers, type Peer } from "@/app/lib/collab/presence";

const peer = (clientId: number, selectedIds: string[] = []): Peer => ({ clientId, user: { id: `u${clientId}`, name: "Ada", image: null }, color: "#175e7a", selectedIds });

describe("samePeers", () => {
  it("treats rebuilt but identical rosters as the same", () => {
    expect(samePeers([peer(1, ["t1"]), peer(2)], [peer(1, ["t1"]), peer(2)])).toBe(true);
  });

  it("notices a joining peer, a selection change and a renamed user", () => {
    expect(samePeers([peer(1)], [peer(1), peer(2)])).toBe(false);
    expect(samePeers([peer(1, ["t1"])], [peer(1, ["t2"])])).toBe(false);
    expect(samePeers([peer(1)], [{ ...peer(1), user: { id: "u1", name: "Grace" } }])).toBe(false);
  });

  it("does not distinguish a missing image from a null one", () => {
    expect(samePeers([peer(1)], [{ ...peer(1), user: { id: "u1", name: "Ada" } }])).toBe(true);
  });
});

describe("createCursorStore", () => {
  it("keeps the snapshot and stays quiet until a cursor actually moves", () => {
    const store = createCursorStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set(new Map([[1, { x: 10, y: 20 }]]));
    const first = store.getSnapshot();
    store.set(new Map([[1, { x: 10, y: 20 }]]));
    expect(store.getSnapshot()).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
    store.set(new Map([[1, { x: 11, y: 20 }]]));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().get(1)).toEqual({ x: 11, y: 20 });
  });

  it("notifies when a cursor leaves and stops notifying after unsubscribe", () => {
    const store = createCursorStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set(new Map([[1, { x: 0, y: 0 }]]));
    store.set(new Map());
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.set(new Map([[2, { x: 0, y: 0 }]]));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
