import { describe, expect, it, vi } from "vitest";
import { aliasFor, createCursorStore, displayName, samePeers, selfAlias, type Peer } from "@/app/lib/collab/presence";

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

describe("shared-login identities", () => {
  const on = (clientId: number, account: string, device: string): Peer => ({ clientId, user: { id: account, name: "Team", image: null, device, alias: aliasFor(device) }, color: "#175e7a", selectedIds: [] });

  it("derives the same alias from the same device, and different ones from different devices", () => {
    expect(aliasFor("device-a")).toBe(aliasFor("device-a"));
    expect(aliasFor("device-a")).toMatch(/^\w+ \w+$/);
    expect(new Set(["a", "b", "c", "d", "e", "f"].map(aliasFor)).size).toBeGreaterThan(1);
  });

  it("shows the account name when the account is in the room once", () => {
    const peers = [on(1, "alice", "d1"), on(2, "bob", "d2")];
    expect(displayName(peers[0], peers, { id: "carol", name: "Carol" })).toBe("Team");
    expect(selfAlias({ id: "carol", name: "Carol", alias: "Calm Fox" }, peers)).toBeUndefined();
  });

  it("shows the alias when two peers share an account", () => {
    const peers = [on(1, "team", "d1"), on(2, "team", "d2")];
    expect(peers.map((peer) => displayName(peer, peers, null))).toEqual([aliasFor("d1"), aliasFor("d2")]);
  });

  it("shows the alias when a peer shares this browser's account", () => {
    const peers = [on(1, "team", "d1")];
    const self = { id: "team", name: "Team", device: "d0", alias: aliasFor("d0") };
    expect(displayName(peers[0], peers, self)).toBe(aliasFor("d1"));
    expect(selfAlias(self, peers)).toBe(aliasFor("d0"));
  });

  it("falls back to the account name for a peer on a build without aliases", () => {
    const old: Peer = { clientId: 2, user: { id: "team", name: "Team" }, color: "#175e7a", selectedIds: [] };
    const peers = [on(1, "team", "d1"), old];
    expect(displayName(old, peers, null)).toBe("Team");
  });

  it("treats an alias change as a roster change", () => {
    expect(samePeers([on(1, "team", "d1")], [on(1, "team", "d2")])).toBe(false);
  });
});
